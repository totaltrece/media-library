import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FfmpegProcessError, FfmpegVideoProcessor } from "../src/adapters/ffmpeg/ffmpeg-video-processor.js";
import type { ProcessResult, RunProcess } from "../src/adapters/ffmpeg/run-process.js";

test("FfmpegVideoProcessor.probe parses ffprobe JSON from the configured executable", async () => {
  const calls: Array<{ executable: string; args: readonly string[] }> = [];
  const processor = new FfmpegVideoProcessor({
    ffmpegPath: "ffmpeg",
    ffprobePath: join("C:", "tools", "ffprobe.exe"),
    runProcess: async (executable, args) => {
      calls.push({ executable, args });
      return {
        stdout: JSON.stringify({
          streams: [{ codec_type: "video", codec_name: "hevc", width: 1080, height: 1920 }],
          format: { duration: "2.5" },
        }),
        stderr: "",
        exitCode: 0,
      };
    },
  });

  const inputPath = join("My Videos", "clip 01.mp4");
  const probe = await processor.probe(inputPath);

  assert.deepEqual(probe, {
    durationSeconds: 2.5,
    width: 1080,
    height: 1920,
    videoCodec: "hevc",
    audioCodec: null,
    recordingTime: null,
  });
  assert.equal(calls[0]?.executable, join("C:", "tools", "ffprobe.exe"));
  assert.equal(calls[0]?.args.at(-1), inputPath);
});

test("FfmpegVideoProcessor.probe surfaces ffprobe failures", async () => {
  const processor = processorWithResults([
    { stdout: "", stderr: "No such file or directory", exitCode: 1 },
  ]);

  await assert.rejects(
    () => processor.probe("missing.mp4"),
    (error: unknown) => {
      assert.ok(error instanceof FfmpegProcessError);
      assert.match(error.message, /ffprobe failed for missing.mp4/);
      assert.match(error.message, /No such file/);
      return true;
    },
  );
});

test("FfmpegVideoProcessor.convert writes only the output path and keeps command args unquoted", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-ffmpeg-convert-"));
  const inputPath = join(directory, "source clip.mp4");
  const outputPath = join(directory, "job dir", "converted.mp4");
  const calls: Array<{ executable: string; args: readonly string[] }> = [];

  try {
    await writeFile(inputPath, "source");
    const processor = new FfmpegVideoProcessor({
      ffmpegPath: String.raw`C:\ffmpeg\bin\ffmpeg.exe`,
      ffprobePath: "ffprobe",
      runProcess: async (executable, args) => {
        calls.push({ executable, args });
        const temporaryOutput = args.at(-1);
        assert.equal(typeof temporaryOutput, "string");
        await writeFile(temporaryOutput ?? "", "converted");
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await processor.convert(inputPath, outputPath);

    assert.equal(calls[0]?.executable, String.raw`C:\ffmpeg\bin\ffmpeg.exe`);
    assert.equal(calls[0]?.args[calls[0].args.indexOf("-i") + 1], inputPath);
    assert.equal(calls[0]?.args[calls[0].args.indexOf("-progress") + 1], "pipe:1");
    assert.equal(await readFile(outputPath, "utf8"), "converted");
    assert.equal(await readFile(inputPath, "utf8"), "source");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FfmpegVideoProcessor.convert reports clamped progress from FFmpeg -progress output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-ffmpeg-progress-"));
  const inputPath = join(directory, "source.mp4");
  const outputPath = join(directory, "converted.mp4");
  const percents: number[] = [];

  try {
    await writeFile(inputPath, "source");
    const processor = new FfmpegVideoProcessor({
      ffmpegPath: "ffmpeg",
      ffprobePath: "ffprobe",
      runProcess: async (_executable, args, options) => {
        const temporaryOutput = args.at(-1);
        options?.onStdout?.("frame=1\nout_time_us=0\n");
        options?.onStdout?.("out_time_us=4700000\n");
        options?.onStdout?.("out_time_us=15000000\nprogress=end\n");
        await writeFile(temporaryOutput ?? "", "converted");
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await processor.convert(inputPath, outputPath, {
      durationSeconds: 10,
      onProgress: (percent) => percents.push(percent),
    });

    assert.deepEqual(percents, [0, 47, 100, 100]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FfmpegVideoProcessor.convert surfaces ffmpeg failures and removes the temp file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-ffmpeg-convert-fail-"));
  const outputPath = join(directory, "converted.mp4");

  try {
    const processor = processorWithResults([{ stdout: "", stderr: "Conversion failed", exitCode: 69 }]);

    await assert.rejects(() => processor.convert(join(directory, "in.mp4"), outputPath), /FFmpeg conversion failed/);
    await assert.rejects(() => readFile(`${outputPath}.converting.mp4`), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FfmpegVideoProcessor.generateThumbnail seeks by duration and writes a jpeg path", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-ffmpeg-thumb-"));
  const inputPath = join(directory, "converted.mp4");
  const outputPath = join(directory, "thumbnail.jpg");
  const calls: Array<readonly string[]> = [];

  try {
    const processor = new FfmpegVideoProcessor({
      ffmpegPath: "ffmpeg",
      ffprobePath: "ffprobe",
      runProcess: async (_executable, args) => {
        calls.push(args);
        if (args.includes("-print_format")) {
          return {
            stdout: JSON.stringify({
              streams: [{ codec_type: "video", codec_name: "h264", width: 320, height: 240 }],
              format: { duration: "10" },
            }),
            stderr: "",
            exitCode: 0,
          };
        }

        await writeFile(args.at(-1) ?? "", "jpeg");
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    await processor.generateThumbnail(inputPath, outputPath);

    assert.equal(calls[1]?.[calls[1].indexOf("-ss") + 1], "5.000");
    assert.equal(await readFile(outputPath, "utf8"), "jpeg");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("FfmpegVideoProcessor.generateThumbnail surfaces ffmpeg failures", async () => {
  const processor = processorWithResults([
    {
      stdout: JSON.stringify({
        streams: [{ codec_type: "video", codec_name: "h264", width: 32, height: 32 }],
        format: { duration: "1" },
      }),
      stderr: "",
      exitCode: 0,
    },
    { stdout: "", stderr: "thumbnail error", exitCode: 1 },
  ]);

  await assert.rejects(
    () => processor.generateThumbnail("in.mp4", join(tmpdir(), "missing-thumb.jpg")),
    /FFmpeg thumbnail generation failed/,
  );
});

function processorWithResults(results: ProcessResult[]): FfmpegVideoProcessor {
  const queue = [...results];
  const runProcess: RunProcess = async () => {
    const next = queue.shift();
    assert.ok(next, "unexpected process call");
    return next;
  };

  return new FfmpegVideoProcessor({
    ffmpegPath: "ffmpeg",
    ffprobePath: "ffprobe",
    runProcess,
  });
}

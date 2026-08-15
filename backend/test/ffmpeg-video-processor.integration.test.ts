import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FfmpegVideoProcessor } from "../src/adapters/ffmpeg/ffmpeg-video-processor.js";
import { FilesystemProcessingWorkspace } from "../src/adapters/filesystem/filesystem-processing-workspace.js";
import { runProcess } from "../src/adapters/ffmpeg/run-process.js";

const ffmpegPath = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH?.trim() || "ffprobe";
const ffmpegAvailable = canRun(ffmpegPath) && canRun(ffprobePath);

test("FfmpegVideoProcessor converts a generated clip and writes a 281x500 JPEG", {
  skip: ffmpegAvailable ? false : "ffmpeg/ffprobe are not available",
}, async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "upload temp "));
  const workspace = new FilesystemProcessingWorkspace(tempRoot);
  const processor = new FfmpegVideoProcessor({ ffmpegPath, ffprobePath });
  const paths = await workspace.prepareJob("job-1");
  const sourcePath = join(paths.directory, "source clip.mp4");

  try {
    await createTestClip(sourcePath);
    const original = await stat(sourcePath);

    const probe = await processor.probe(sourcePath);
    assert.equal(probe.videoCodec, "h264");
    assert.ok(probe.durationSeconds > 0);
    assert.equal(probe.width, 320);
    assert.equal(probe.height, 240);

    await processor.convert(sourcePath, paths.convertedPath);
    const convertedProbe = await processor.probe(paths.convertedPath);
    assert.equal(convertedProbe.videoCodec, "h264");
    assert.ok((await stat(paths.convertedPath)).size > 0);

    await processor.generateThumbnail(paths.convertedPath, paths.thumbnailPath);
    const jpeg = await readFile(paths.thumbnailPath);
    assert.equal(jpeg[0], 0xff);
    assert.equal(jpeg[1], 0xd8);
    assert.deepEqual(await readImageSize(paths.thumbnailPath), { width: 281, height: 500 });

    const hevcPath = join(paths.directory, "hevc clip.mp4");
    if (await tryCreateHevcClip(hevcPath)) {
      assert.equal((await processor.probe(hevcPath)).videoCodec, "hevc");
      const fromHevc = join(paths.directory, "from-hevc.mp4");
      await processor.convert(hevcPath, fromHevc);
      assert.equal((await processor.probe(fromHevc)).videoCodec, "h264");
    }

    const after = await stat(sourcePath);
    assert.equal(after.size, original.size);
    assert.equal(after.mtimeMs, original.mtimeMs);
  } finally {
    await workspace.discardJob("job-1");
    await rm(tempRoot, { recursive: true, force: true });
  }
});

async function readImageSize(imagePath: string): Promise<{ width: number; height: number }> {
  const result = await runProcess(ffprobePath, [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_streams",
    "--",
    imagePath,
  ]);
  assert.equal(result.exitCode, 0, result.stderr);

  const parsed: unknown = JSON.parse(result.stdout);
  assert.ok(typeof parsed === "object" && parsed !== null);
  const streams = (parsed as { streams?: unknown }).streams;
  assert.ok(Array.isArray(streams));
  const stream = streams[0];
  assert.ok(typeof stream === "object" && stream !== null);
  const width = (stream as { width?: unknown }).width;
  const height = (stream as { height?: unknown }).height;
  assert.ok(typeof width === "number");
  assert.ok(typeof height === "number");

  return { width, height };
}

async function tryCreateHevcClip(outputPath: string): Promise<boolean> {
  const result = await runProcess(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=1:size=320x240:rate=1",
    "-c:v",
    "libx265",
    "-t",
    "1",
    "-y",
    outputPath,
  ]);

  return result.exitCode === 0;
}

async function createTestClip(outputPath: string): Promise<void> {
  const result = await runProcess(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc=duration=2:size=320x240:rate=25",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:duration=2",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-shortest",
    "-y",
    outputPath,
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
}

function canRun(executable: string): boolean {
  const result = spawnSync(executable, ["-version"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 5000,
  });

  return result.status === 0;
}

import { mkdir, rename, rm, stat } from "node:fs/promises";
import { dirname } from "node:path";

import { conversionProgressPercent } from "../../application/conversion-progress.js";
import { resolveThumbnailGenerationOptions } from "../../application/thumbnail-generation-options.js";
import type {
  ThumbnailGenerationOptions,
  VideoConvertOptions,
  VideoProbeResult,
  VideoProcessor,
} from "../../ports/video-processor.js";
import {
  buildFfmpegConvertArgs,
  buildFfmpegThumbnailArgs,
  buildFfprobeArgs,
} from "./ffmpeg-commands.js";
import { parseFfmpegOutTimeSeconds } from "./parse-ffmpeg-progress.js";
import { parseFfprobeJson } from "./parse-ffprobe-json.js";
import { runProcess as spawnProcess, type ProcessResult, type RunProcess } from "./run-process.js";

const STDERR_LIMIT = 4000;

export class FfmpegProcessError extends Error {
  readonly executable: string;
  readonly args: readonly string[];
  readonly exitCode: number;
  readonly stderr: string;

  constructor(params: {
    operation: string;
    inputPath: string;
    executable: string;
    args: readonly string[];
    result: ProcessResult;
  }) {
    const detail = params.result.stderr.trim().length > 0
      ? truncate(params.result.stderr.trim(), STDERR_LIMIT)
      : `exit code ${params.result.exitCode}`;

    super(`${params.operation} failed for ${params.inputPath}: ${detail}`);
    this.name = "FfmpegProcessError";
    this.executable = params.executable;
    this.args = params.args;
    this.exitCode = params.result.exitCode;
    this.stderr = params.result.stderr;
  }
}

export class FfmpegVideoProcessor implements VideoProcessor {
  private readonly ffmpegPath: string;
  private readonly ffprobePath: string;
  private readonly runProcess: RunProcess;

  constructor(options: {
    ffmpegPath: string;
    ffprobePath: string;
    runProcess?: RunProcess;
  }) {
    this.ffmpegPath = options.ffmpegPath;
    this.ffprobePath = options.ffprobePath;
    this.runProcess = options.runProcess ?? spawnProcess;
  }

  async probe(inputPath: string): Promise<VideoProbeResult> {
    const args = buildFfprobeArgs(inputPath);
    const result = await this.runProcess(this.ffprobePath, args);

    if (result.exitCode !== 0) {
      throw new FfmpegProcessError({
        operation: "ffprobe",
        inputPath,
        executable: this.ffprobePath,
        args,
        result,
      });
    }

    return parseFfprobeJson(result.stdout);
  }

  async convert(inputPath: string, outputPath: string, options?: VideoConvertOptions): Promise<void> {
    await mkdir(dirname(outputPath), { recursive: true });

    const temporaryOutput = `${outputPath}.converting.mp4`;
    await rm(temporaryOutput, { force: true });

    const args = buildFfmpegConvertArgs(inputPath, temporaryOutput);
    const onStdout = createConvertProgressHandler(options);

    try {
      const result = await this.runProcess(this.ffmpegPath, args, onStdout === undefined ? undefined : { onStdout });

      if (result.exitCode !== 0) {
        throw new FfmpegProcessError({
          operation: "FFmpeg conversion",
          inputPath,
          executable: this.ffmpegPath,
          args,
          result,
        });
      }

      if (!(await pathExists(temporaryOutput))) {
        throw new Error("FFmpeg reported success but produced no output file");
      }

      await rm(outputPath, { force: true });
      await rename(temporaryOutput, outputPath);
    } catch (error) {
      await rm(temporaryOutput, { force: true });
      throw error;
    }
  }

  async generateThumbnail(
    inputPath: string,
    outputPath: string,
    options?: Partial<ThumbnailGenerationOptions>,
  ): Promise<void> {
    const resolved = resolveThumbnailGenerationOptions(options);
    const probe = await this.probe(inputPath);
    const seekSeconds = probe.durationSeconds * resolved.positionRatio;

    await mkdir(dirname(outputPath), { recursive: true });

    const temporaryOutput = `${outputPath}.generating.jpg`;
    await rm(temporaryOutput, { force: true });

    const args = buildFfmpegThumbnailArgs(inputPath, temporaryOutput, resolved, seekSeconds);

    try {
      const result = await this.runProcess(this.ffmpegPath, args);

      if (result.exitCode !== 0) {
        throw new FfmpegProcessError({
          operation: "FFmpeg thumbnail generation",
          inputPath,
          executable: this.ffmpegPath,
          args,
          result,
        });
      }

      if (!(await pathExists(temporaryOutput))) {
        throw new Error("FFmpeg reported success but produced no thumbnail");
      }

      await rm(outputPath, { force: true });
      await rename(temporaryOutput, outputPath);
    } catch (error) {
      await rm(temporaryOutput, { force: true });
      throw error;
    }
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function createConvertProgressHandler(options?: VideoConvertOptions): ((chunk: string) => void) | undefined {
  const onProgress = options?.onProgress;
  const durationSeconds = options?.durationSeconds;

  if (onProgress === undefined || durationSeconds === undefined) {
    return undefined;
  }

  let leftover = "";

  return (chunk: string) => {
    leftover += chunk;
    const lines = leftover.split(/\r\n|\n|\r/);
    leftover = lines.pop() ?? "";

    for (const line of lines) {
      if (line.trim() === "progress=end") {
        onProgress(100);
        continue;
      }

      const outTimeSeconds = parseFfmpegOutTimeSeconds(line);

      if (outTimeSeconds === null) {
        continue;
      }

      onProgress(conversionProgressPercent(outTimeSeconds, durationSeconds));
    }
  };
}

function truncate(value: string, limit: number): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

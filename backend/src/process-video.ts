import { randomUUID } from "node:crypto";
import { basename, resolve } from "node:path";
import { stat } from "node:fs/promises";

import { FfmpegVideoProcessor } from "./adapters/ffmpeg/ffmpeg-video-processor.js";
import { FilesystemProcessingWorkspace } from "./adapters/filesystem/filesystem-processing-workspace.js";
import { InMemoryProcessingJobStore } from "./adapters/in-memory-processing-job-store.js";
import { ProcessVideoJobUseCase, type ProcessVideoJobProgressEvent } from "./application/process-video-job.js";
import { config } from "./config.js";

interface CliOptions {
  videoPath: string;
  discard: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const videoPath = resolve(options.videoPath);
  const originalStat = await stat(videoPath);

  if (!originalStat.isFile()) {
    throw new Error(`Video path is not a file: ${videoPath}`);
  }

  const useCase = new ProcessVideoJobUseCase(
    new FfmpegVideoProcessor({
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
    }),
    new FilesystemProcessingWorkspace(config.uploadTempPath),
    new InMemoryProcessingJobStore(),
  );

  const jobId = randomUUID();

  console.log("Processing video");
  console.log("");
  console.log(`Job: ${jobId}`);
  console.log(`Input: ${videoPath}`);
  console.log("");

  const result = await useCase.execute(
    {
      inputPath: videoPath,
      originalName: basename(videoPath),
      jobId,
    },
    { onProgress: printProgress },
  );

  console.log("");

  if (result.status === "failed") {
    console.log(`Status: failed`);
    console.log(`Error:  ${result.error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Status: completed");
  console.log("");
  console.log(`Output video: ${result.outputVideoPath}`);
  console.log(`Thumbnail:    ${result.thumbnailPath}`);
  console.log(`Workspace:    ${result.workspaceDirectory}`);
  console.log(`Converted:    ${result.converted ? "yes" : "no"}`);
  console.log("");
  console.log(`Original unchanged: ${videoPath} (${originalStat.size} bytes)`);

  const afterStat = await stat(videoPath);
  if (afterStat.size !== originalStat.size || afterStat.mtimeMs !== originalStat.mtimeMs) {
    throw new Error("Original video was modified");
  }

  if (options.discard) {
    const workspace = new FilesystemProcessingWorkspace(config.uploadTempPath);
    await workspace.discardJob(result.jobId);
    console.log("");
    console.log("Workspace discarded (--discard).");
  }
}

function printProgress(event: ProcessVideoJobProgressEvent): void {
  switch (event.step) {
    case "probe":
      console.log("[probe]                  OK");
      return;
    case "processing":
      if (event.outcome === "detected") {
        console.log(`[processing]             ${formatCodec(event.videoCodec)} detected`);
        return;
      }
      if (event.outcome === "converting") {
        console.log("[processing]             converting");
        return;
      }
      if (event.outcome === "skipped") {
        console.log("[processing]             conversion skipped");
        return;
      }
      console.log("[processing]             OK");
      return;
    case "generating_thumbnail":
      console.log("[generating_thumbnail]   OK");
      return;
    case "finalizing":
      console.log("[finalizing]             OK");
  }
}

function formatCodec(videoCodec: string | null): string {
  if (videoCodec === "hevc") {
    return "HEVC";
  }

  if (videoCodec === "h264") {
    return "H.264";
  }

  return videoCodec ?? "unknown codec";
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Set<string>();
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg === "--discard" || arg === "--keep" || arg === "--help" || arg === "-h") {
      flags.add(arg);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  if (flags.has("--help") || flags.has("-h") || positional.length === 0) {
    printUsage();
    if (positional.length === 0 && !flags.has("--help") && !flags.has("-h")) {
      process.exitCode = 1;
    }
    process.exit(process.exitCode ?? 0);
  }

  if (positional.length !== 1) {
    throw new Error("Provide exactly one video path");
  }

  return {
    videoPath: positional[0] ?? "",
    discard: flags.has("--discard"),
  };
}

function printUsage(): void {
  console.log(`Usage: pnpm --filter @media-library/backend process-video -- <video> [--keep] [--discard]

Run the M3 processing job pipeline: stage a copy, probe, convert HEVC to H.264, generate a thumbnail.
The original file is never modified. On success the workspace is kept for inspection (M4/M5).

Options:
  --keep      Keep the workspace (default on success)
  --discard   Remove the workspace after a successful run
  -h, --help  Show this help

Example:
  pnpm --filter @media-library/backend process-video -- "${examplePath()}"
`);
}

function examplePath(): string {
  return process.platform === "win32" ? String.raw`C:\path\to\clip.mp4` : "/path/to/clip.mp4";
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

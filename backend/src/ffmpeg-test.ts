import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { FfmpegVideoProcessor } from "./adapters/ffmpeg/ffmpeg-video-processor.js";
import { FilesystemProcessingWorkspace } from "./adapters/filesystem/filesystem-processing-workspace.js";
import { config } from "./config.js";

interface CliOptions {
  videoPath: string;
  keep: boolean;
  forceConvert: boolean;
  skipConvert: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const videoPath = resolve(options.videoPath);
  const originalStat = await stat(videoPath);

  if (!originalStat.isFile()) {
    throw new Error(`Video path is not a file: ${videoPath}`);
  }

  const processor = new FfmpegVideoProcessor({
    ffmpegPath: config.ffmpegPath,
    ffprobePath: config.ffprobePath,
  });
  const workspace = new FilesystemProcessingWorkspace(config.uploadTempPath);
  const jobId = `ffmpeg-test-${randomUUID()}`;
  const paths = await workspace.prepareJob(jobId);

  console.log("FFmpeg test (M2)");
  console.log(`Input:          ${videoPath}`);
  console.log(`ffmpeg:         ${config.ffmpegPath}`);
  console.log(`ffprobe:        ${config.ffprobePath}`);
  console.log(`Workspace:      ${paths.directory}`);
  console.log("");

  try {
    const probe = await processor.probe(videoPath);
    console.log("Probe");
    console.log(`  codec:        ${probe.videoCodec ?? "(unknown)"}`);
    console.log(`  audio:        ${probe.audioCodec ?? "(none)"}`);
    console.log(`  duration:     ${probe.durationSeconds.toFixed(3)} s`);
    console.log(`  resolution:   ${probe.width}x${probe.height}`);
    console.log("");

    const conversionNeeded = probe.videoCodec === "hevc";
    const shouldConvert = options.skipConvert ? false : options.forceConvert || conversionNeeded;

    if (options.skipConvert) {
      console.log("Conversion skipped (--skip-convert).");
    } else if (!conversionNeeded && !options.forceConvert) {
      console.log(`Codec is ${probe.videoCodec ?? "unknown"}; conversion is not required.`);
      console.log("Pass --convert to exercise convert() anyway.");
    }

    let thumbnailSource = videoPath;

    if (shouldConvert) {
      console.log("");
      console.log("Converting to H.264...");
      await processor.convert(videoPath, paths.convertedPath);
      const convertedStat = await stat(paths.convertedPath);
      console.log(`Converted:      ${paths.convertedPath} (${formatMegabytes(convertedStat.size)})`);
      thumbnailSource = paths.convertedPath;
    }

    console.log("");
    console.log("Generating thumbnail...");
    await processor.generateThumbnail(thumbnailSource, paths.thumbnailPath);
    const thumbnailStat = await stat(paths.thumbnailPath);
    console.log(`Thumbnail:      ${paths.thumbnailPath} (${thumbnailStat.size} bytes)`);
    console.log("");
    console.log(`Original unchanged: ${videoPath} (${originalStat.size} bytes)`);

    const afterStat = await stat(videoPath);
    if (afterStat.size !== originalStat.size || afterStat.mtimeMs !== originalStat.mtimeMs) {
      throw new Error("Original video was modified");
    }
  } finally {
    if (options.keep) {
      console.log("");
      console.log(`Keeping workspace: ${paths.directory}`);
    } else {
      await workspace.discardJob(jobId);
      console.log("");
      console.log("Workspace discarded.");
    }
  }
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Set<string>();
  const positional: string[] = [];

  for (const arg of argv) {
    if (arg === "--keep" || arg === "--convert" || arg === "--skip-convert" || arg === "--help" || arg === "-h") {
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

  if (flags.has("--convert") && flags.has("--skip-convert")) {
    throw new Error("Use either --convert or --skip-convert, not both");
  }

  return {
    videoPath: positional[0] ?? "",
    keep: flags.has("--keep"),
    forceConvert: flags.has("--convert"),
    skipConvert: flags.has("--skip-convert"),
  };
}

function printUsage(): void {
  console.log(`Usage: pnpm --filter @media-library/backend ffmpeg-test -- <video> [--keep] [--convert] [--skip-convert]

Inspect a video with ffprobe, optionally convert it with ffmpeg, and generate a 281x500 JPEG thumbnail.
The original file is never modified. Outputs go to a temporary job directory.

Options:
  --convert        Always run convert(), even when the source is already H.264
  --skip-convert   Skip conversion and generate the thumbnail from the original
  --keep           Leave the workspace on disk after the test
  -h, --help       Show this help

Example:
  pnpm --filter @media-library/backend ffmpeg-test -- "${examplePath()}"
`);
}

function examplePath(): string {
  return process.platform === "win32" ? String.raw`C:\path\to\clip.mp4` : "/path/to/clip.mp4";
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

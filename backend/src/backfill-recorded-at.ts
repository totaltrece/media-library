import { FfmpegVideoProcessor } from "./adapters/ffmpeg/ffmpeg-video-processor.js";
import { openSqliteLibraryStore } from "./adapters/sqlite/sqlite-library-store.js";
import { BackfillRecordedAtUseCase } from "./application/backfill-recorded-at.js";
import { config } from "./config.js";

interface CliOptions {
  dryRun: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const libraryStore = openSqliteLibraryStore(config.sqlitePath);

  try {
    const result = await new BackfillRecordedAtUseCase(
      libraryStore,
      new FfmpegVideoProcessor({
        ffmpegPath: config.ffmpegPath,
        ffprobePath: config.ffprobePath,
      }),
      config.libraryPath,
    ).execute({ dryRun: options.dryRun });

    console.log(options.dryRun ? "Backfill recorded_at (dry-run)" : "Backfill recorded_at");
    console.log("");
    console.log(`Library: ${config.libraryPath}`);
    console.log(`SQLite:  ${config.sqlitePath}`);
    console.log("");

    for (const preview of result.previews) {
      console.log(preview.videoId);
      console.log(`  source: ${preview.source}`);
      console.log(`  current: ${preview.current ?? "NULL"}`);
      console.log(`  detected: ${preview.detected ?? "NULL"}`);
    }

    if (result.errors.length > 0) {
      console.log("");
      console.log("Errors:");

      for (const error of result.errors) {
        console.log(`- ${error.videoId}: ${error.message}`);
      }
    }

    console.log("");
    console.log(`Videos processed: ${result.processed}`);
    console.log(`Dates detected:   ${result.detected}`);
    console.log(`Dates updated:    ${result.updated}${options.dryRun ? " (dry-run, not written)" : ""}`);
    console.log(`Without date:     ${result.withoutDate}`);
    console.log(`Errors:           ${result.errors.length}`);

    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    libraryStore.close();
  }
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Set<string>();

  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--help" || arg === "-h") {
      flags.add(arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (flags.has("--help") || flags.has("-h")) {
    printHelp();
    process.exit(0);
  }

  return {
    dryRun: flags.has("--dry-run"),
  };
}

function printHelp(): void {
  console.log("Usage: pnpm --filter @media-library/backend backfill-recorded-at -- [--dry-run]");
  console.log("");
  console.log("Fills SQLite recorded_at from ffprobe metadata of existing library videos.");
  console.log("Names with YYYYMMDD may fall back to that day at 20:00 Europe/Madrid.");
  console.log("Does not modify video files, thumbnails, or tags.");
  console.log("");
  console.log("  --dry-run   Probe and print dates without writing to SQLite");
}

void main();

import { stat } from "node:fs/promises";

import type { LibraryStore } from "../ports/library-store.js";
import type { VideoProcessor } from "../ports/video-processor.js";

import { resolveLibraryVideoPath } from "./library-media-paths.js";
import { toStoredRecordedAt } from "./resolve-canonical-upload-name.js";
import { recordedAtFromFileName } from "./filename-recorded-at-fallback.js";

export type RecordedAtSource = "ffprobe" | "filename-fallback" | "none";

export interface BackfillRecordedAtPreview {
  videoId: string;
  source: RecordedAtSource;
  current: string | null;
  detected: string | null;
}

export interface BackfillRecordedAtError {
  videoId: string;
  message: string;
}

export interface BackfillRecordedAtResult {
  processed: number;
  detected: number;
  updated: number;
  withoutDate: number;
  errors: BackfillRecordedAtError[];
  previews: BackfillRecordedAtPreview[];
}

/**
 * Fills SQLite `recorded_at` from ffprobe metadata of existing library files.
 * If ffprobe has no reliable date, a valid YYYYMMDD in the filename falls back
 * to that calendar day at 20:00 Europe/Madrid (approximate).
 * Does not convert, rename, or write media. Safe to run more than once.
 * New uploads do not use the filename fallback.
 */
export class BackfillRecordedAtUseCase {
  constructor(
    private readonly libraryStore: LibraryStore,
    private readonly processor: VideoProcessor,
    private readonly libraryPath: string,
  ) {}

  async execute(options: { dryRun: boolean }): Promise<BackfillRecordedAtResult> {
    const result: BackfillRecordedAtResult = {
      processed: 0,
      detected: 0,
      updated: 0,
      withoutDate: 0,
      errors: [],
      previews: [],
    };

    for (const video of this.libraryStore.listVideos()) {
      result.processed += 1;

      try {
        const { detected, source } = await this.detectRecordedAt(video.id);
        result.previews.push({
          videoId: video.id,
          source,
          current: video.recordedAt,
          detected,
        });

        if (detected === null) {
          if (video.recordedAt === null) {
            result.withoutDate += 1;
          }

          continue;
        }

        result.detected += 1;

        if (video.recordedAt === detected) {
          continue;
        }

        if (!options.dryRun) {
          this.libraryStore.setVideoRecordedAt(video.id, detected);
        }

        result.updated += 1;
      } catch (error: unknown) {
        result.errors.push({
          videoId: video.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  private async detectRecordedAt(
    videoId: string,
  ): Promise<{ detected: string | null; source: RecordedAtSource }> {
    const videoPath = resolveLibraryVideoPath(this.libraryPath, videoId);

    if (videoPath === undefined) {
      throw new Error(`Invalid media id: ${videoId}`);
    }

    const file = await stat(videoPath);

    if (!file.isFile()) {
      throw new Error(`Library path is not a file: ${videoId}`);
    }

    const probe = await this.processor.probe(videoPath);
    const fromProbe = toStoredRecordedAt(probe.recordingTime);

    if (fromProbe !== null) {
      return { detected: fromProbe, source: "ffprobe" };
    }

    const fromName = recordedAtFromFileName(videoId);

    if (fromName !== null) {
      return { detected: fromName, source: "filename-fallback" };
    }

    return { detected: null, source: "none" };
  }
}

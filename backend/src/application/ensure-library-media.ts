import { stat } from "node:fs/promises";

import type { LibraryStore } from "../ports/library-store.js";
import type { VideoDiscovery } from "../ports/video-discovery.js";
import type { VideoProcessor } from "../ports/video-processor.js";

import { detectRecordedAt } from "./detect-recorded-at.js";
import { resolveLibraryThumbnailPath, resolveLibraryVideoPath } from "./library-media-paths.js";
import { toMediaId } from "./media-id.js";

export interface EnsureLibraryMediaError {
  videoId: string;
  message: string;
}

export interface EnsureLibraryMediaResult {
  processed: number;
  datesFilled: number;
  thumbnailsGenerated: number;
  errors: EnsureLibraryMediaError[];
}

export interface EnsureLibraryMedia {
  execute(): Promise<EnsureLibraryMediaResult>;
}

/**
 * Fills missing `recorded_at` and TagSpaces thumbnails for videos already on
 * disk. Does not overwrite existing dates or thumbnail files, convert video,
 * or change tags.
 */
export class EnsureLibraryMediaUseCase implements EnsureLibraryMedia {
  constructor(
    private readonly videoDiscovery: VideoDiscovery,
    private readonly libraryStore: LibraryStore,
    private readonly processor: VideoProcessor,
    private readonly libraryPath: string,
  ) {}

  async execute(): Promise<EnsureLibraryMediaResult> {
    const result: EnsureLibraryMediaResult = {
      processed: 0,
      datesFilled: 0,
      thumbnailsGenerated: 0,
      errors: [],
    };

    const videoPaths = await this.videoDiscovery.discoverVideoPaths();

    for (const videoPath of videoPaths) {
      const videoId = toMediaId(videoPath, this.libraryPath);
      result.processed += 1;

      try {
        const video = this.libraryStore.findVideo(videoId);

        if (video === null) {
          continue;
        }

        if (video.recordedAt === null) {
          const { detected } = await detectRecordedAt(videoId, this.libraryPath, this.processor);

          if (detected !== null) {
            this.libraryStore.setVideoRecordedAt(videoId, detected);
            result.datesFilled += 1;
          }
        }

        if (await this.generateMissingThumbnail(videoId, videoPath)) {
          result.thumbnailsGenerated += 1;
        }
      } catch (error: unknown) {
        result.errors.push({
          videoId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  private async generateMissingThumbnail(videoId: string, videoPath: string): Promise<boolean> {
    const thumbnailPath = resolveLibraryThumbnailPath(this.libraryPath, videoId);
    const resolvedVideoPath = resolveLibraryVideoPath(this.libraryPath, videoId) ?? videoPath;

    if (thumbnailPath === undefined) {
      return false;
    }

    if (await isExistingFile(thumbnailPath)) {
      return false;
    }

    await this.processor.generateThumbnail(resolvedVideoPath, thumbnailPath);
    return true;
  }
}

async function isExistingFile(path: string): Promise<boolean> {
  try {
    const file = await stat(path);
    return file.isFile();
  } catch {
    return false;
  }
}

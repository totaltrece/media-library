import type { LibraryIndexer } from "../ports/library-indexer.js";
import type { LibraryStore } from "../ports/library-store.js";

import { toMediaId } from "./media-id.js";
import { uniquePreserveOrder } from "./unique-preserve-order.js";

export interface ImportLibraryError {
  videoId: string;
  videoPath: string;
  message: string;
}

export interface ImportLibraryResult {
  discovered: number;
  imported: number;
  withoutMetadata: number;
  withoutTags: number;
  tagsCreated: number;
  errors: ImportLibraryError[];
}

export class ImportLibraryUseCase {
  constructor(
    private readonly libraryIndexer: LibraryIndexer,
    private readonly libraryStore: LibraryStore,
    private readonly libraryPath: string,
  ) {}

  async execute(): Promise<ImportLibraryResult> {
    const indexedVideos = await this.libraryIndexer.index();
    const tagsBeforeImport = new Set(this.libraryStore.listTags().map((tag) => tag.name));

    const result: ImportLibraryResult = {
      discovered: indexedVideos.length,
      imported: 0,
      withoutMetadata: 0,
      withoutTags: 0,
      tagsCreated: 0,
      errors: [],
    };

    for (const video of indexedVideos) {
      const videoId = toMediaId(video.videoPath, this.libraryPath);
      const tags = uniquePreserveOrder(video.tags);

      if (video.metadataPath === undefined) {
        result.withoutMetadata += 1;
      }

      if (tags.length === 0) {
        result.withoutTags += 1;
      }

      try {
        this.libraryStore.upsertVideo(videoId);
        this.libraryStore.setVideoTags(videoId, tags);
        result.imported += 1;
      } catch (error: unknown) {
        result.errors.push({
          videoId,
          videoPath: video.videoPath,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    result.tagsCreated = this.libraryStore
      .listTags()
      .filter((tag) => !tagsBeforeImport.has(tag.name)).length;

    return result;
  }
}

import type { LibraryStore } from "../ports/library-store.js";
import type { VideoDiscovery } from "../ports/video-discovery.js";

import { toMediaId } from "./media-id.js";

export interface SyncNewVideosResult {
  discovered: number;
  inserted: number;
}

export class SyncNewVideosUseCase {
  constructor(
    private readonly videoDiscovery: VideoDiscovery,
    private readonly libraryStore: LibraryStore,
    private readonly libraryPath: string,
  ) {}

  async execute(): Promise<SyncNewVideosResult> {
    const videoPaths = await this.videoDiscovery.discoverVideoPaths();
    let inserted = 0;

    for (const videoPath of videoPaths) {
      const videoId = toMediaId(videoPath, this.libraryPath);

      if (this.libraryStore.findVideo(videoId) !== null) {
        continue;
      }

      this.libraryStore.upsertVideo(videoId);
      inserted += 1;
    }

    return {
      discovered: videoPaths.length,
      inserted,
    };
  }
}

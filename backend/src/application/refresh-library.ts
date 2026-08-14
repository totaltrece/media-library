import type { LibraryIndexer } from "../ports/library-indexer.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import type { SyncNewVideosUseCase } from "./sync-new-videos.js";

export interface RefreshLibraryResponse {
  count: number;
}

export class RefreshLibraryUseCase {
  constructor(
    private readonly syncNewVideos: SyncNewVideosUseCase,
    private readonly libraryIndexer: LibraryIndexer,
    private readonly videoIndex: MutableVideoIndex,
  ) {}

  async execute(): Promise<RefreshLibraryResponse> {
    await this.syncNewVideos.execute();
    const videos = await this.libraryIndexer.index();

    this.videoIndex.replaceVideos(videos);

    return {
      count: videos.length,
    };
  }
}

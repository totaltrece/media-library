import type { LibraryIndexer } from "../ports/library-indexer.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

export interface RefreshLibraryResponse {
  count: number;
}

export class RefreshLibraryUseCase {
  constructor(
    private readonly libraryIndexer: LibraryIndexer,
    private readonly videoIndex: MutableVideoIndex,
  ) {}

  async execute(): Promise<RefreshLibraryResponse> {
    const videos = await this.libraryIndexer.index();

    this.videoIndex.replaceVideos(videos);

    return {
      count: videos.length,
    };
  }
}

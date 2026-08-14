import type { IndexedVideo } from "@media-library/indexer";

import { toIndexedVideos } from "../../application/to-indexed-videos.js";
import type { LibraryIndexer } from "../../ports/library-indexer.js";
import type { LibraryStore } from "../../ports/library-store.js";

export class SqliteLibraryIndexer implements LibraryIndexer {
  constructor(
    private readonly libraryStore: LibraryStore,
    private readonly libraryPath: string,
  ) {}

  async index(): Promise<IndexedVideo[]> {
    return toIndexedVideos(this.libraryStore.listVideosWithTags(), this.libraryPath);
  }
}

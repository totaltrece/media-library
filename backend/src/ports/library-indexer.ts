import type { IndexedVideo } from "@media-library/indexer";

export interface LibraryIndexer {
  index(): Promise<IndexedVideo[]>;
}

import type { IndexedVideo } from "@media-library/indexer";

export interface VideoIndex {
  getVideos(): IndexedVideo[];
}

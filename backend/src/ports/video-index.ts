import type { IndexedVideo } from "@media-library/indexer";

export interface VideoIndex {
  getVideos(): IndexedVideo[];
}

export interface MutableVideoIndex extends VideoIndex {
  replaceVideos(videos: IndexedVideo[]): void;
}

export function isMutableVideoIndex(videoIndex: VideoIndex): videoIndex is MutableVideoIndex {
  return typeof (videoIndex as MutableVideoIndex).replaceVideos === "function";
}

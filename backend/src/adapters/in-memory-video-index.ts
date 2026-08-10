import type { IndexedVideo } from "@media-library/indexer";

import type { MutableVideoIndex } from "../ports/video-index.js";

export class InMemoryVideoIndex implements MutableVideoIndex {
  constructor(private videos: IndexedVideo[]) {}

  getVideos(): IndexedVideo[] {
    return this.videos;
  }

  replaceVideos(videos: IndexedVideo[]): void {
    this.videos = videos;
  }
}

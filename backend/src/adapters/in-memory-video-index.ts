import type { IndexedVideo } from "@media-library/indexer";

import type { VideoIndex } from "../ports/video-index.js";

export class InMemoryVideoIndex implements VideoIndex {
  constructor(private readonly videos: IndexedVideo[]) {}

  getVideos(): IndexedVideo[] {
    return this.videos;
  }
}

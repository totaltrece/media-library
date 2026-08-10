import type { IndexedVideo } from "@media-library/indexer";
import { searchVideos } from "@media-library/search";

import type { VideoIndex } from "../ports/video-index.js";

export interface SearchVideosInput {
  tags?: string[];
}

export class SearchVideosUseCase {
  constructor(private readonly videoIndex: VideoIndex) {}

  execute(input: SearchVideosInput): IndexedVideo[] {
    return searchVideos(this.videoIndex.getVideos(), { tags: input.tags });
  }
}

import type { LibraryStore } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { reloadVideoIndex } from "./reload-video-index.js";
import { VideoNotFoundError } from "./video-not-found-error.js";
import type { VideoTagsResponse } from "./get-video-tags.js";

export class RemoveVideoTagUseCase {
  constructor(
    private readonly libraryStore: LibraryStore,
    private readonly videoIndex: MutableVideoIndex,
    private readonly libraryPath: string,
  ) {}

  execute(videoId: string, tagName: string): VideoTagsResponse {
    if (this.libraryStore.findVideo(videoId) === null) {
      throw new VideoNotFoundError(videoId);
    }

    this.libraryStore.removeVideoTag(videoId, tagName);
    reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);

    return {
      tags: this.libraryStore.getVideoTags(videoId),
    };
  }
}

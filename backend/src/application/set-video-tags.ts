import type { LibraryStore } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { reloadVideoIndex } from "./reload-video-index.js";
import { uniquePreserveOrder } from "./unique-preserve-order.js";
import { VideoNotFoundError } from "./video-not-found-error.js";
import type { VideoTagsResponse } from "./get-video-tags.js";

export class SetVideoTagsUseCase {
  constructor(
    private readonly libraryStore: LibraryStore,
    private readonly videoIndex: MutableVideoIndex,
    private readonly libraryPath: string,
  ) {}

  async execute(videoId: string, tagNames: string[]): Promise<VideoTagsResponse> {
    if (await this.libraryStore.findVideo(videoId) === null) {
      throw new VideoNotFoundError(videoId);
    }

    await this.libraryStore.setVideoTags(videoId, uniquePreserveOrder(tagNames));
    await reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);

    return {
      tags: await this.libraryStore.getVideoTags(videoId),
    };
  }
}

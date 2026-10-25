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

  async execute(videoId: string, tagName: string): Promise<VideoTagsResponse> {
    if (await this.libraryStore.findVideo(videoId) === null) {
      throw new VideoNotFoundError(videoId);
    }

    await this.libraryStore.removeVideoTag(videoId, tagName);
    await reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);

    return {
      tags: await this.libraryStore.getVideoTags(videoId),
    };
  }
}

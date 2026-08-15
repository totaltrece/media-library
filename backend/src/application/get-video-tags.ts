import type { LibraryStore } from "../ports/library-store.js";

import { VideoNotFoundError } from "./video-not-found-error.js";

export interface VideoTagsResponse {
  tags: string[];
}

export class GetVideoTagsUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  execute(videoId: string): VideoTagsResponse {
    if (this.libraryStore.findVideo(videoId) === null) {
      throw new VideoNotFoundError(videoId);
    }

    return {
      tags: this.libraryStore.getVideoTags(videoId),
    };
  }
}

import type { LibraryStore } from "../ports/library-store.js";

import { VideoNotFoundError } from "./video-not-found-error.js";

export interface VideoTagsResponse {
  tags: string[];
}

export class GetVideoTagsUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  async execute(videoId: string): Promise<VideoTagsResponse> {
    if (await this.libraryStore.findVideo(videoId) === null) {
      throw new VideoNotFoundError(videoId);
    }

    return {
      tags: await this.libraryStore.getVideoTags(videoId),
    };
  }
}

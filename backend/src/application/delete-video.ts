import type { LibraryMediaInstaller } from "../ports/library-media-installer.js";
import type { LibraryStore } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { InvalidMediaIdError } from "./invalid-media-id-error.js";
import { resolveLibraryVideoPath } from "./library-media-paths.js";
import { reloadVideoIndex } from "./reload-video-index.js";
import { VideoNotFoundError } from "./video-not-found-error.js";

export class DeleteVideoUseCase {
  constructor(
    private readonly installer: LibraryMediaInstaller,
    private readonly libraryStore: LibraryStore,
    private readonly videoIndex: MutableVideoIndex,
    private readonly libraryPath: string,
  ) {}

  async execute(videoId: string): Promise<{ id: string }> {
    if (resolveLibraryVideoPath(this.libraryPath, videoId) === undefined) {
      throw new InvalidMediaIdError(videoId);
    }

    if (await this.libraryStore.findVideo(videoId) === null) {
      throw new VideoNotFoundError(videoId);
    }

    await this.installer.removeVideo(videoId);
    await this.installer.removeThumbnail(videoId);
    await this.libraryStore.deleteVideo(videoId);
    await reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);

    return { id: videoId };
  }
}

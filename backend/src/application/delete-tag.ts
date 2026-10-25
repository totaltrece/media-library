import type { LibraryStore } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { reloadVideoIndex } from "./reload-video-index.js";
import { TagNotFoundError } from "./tag-not-found-error.js";

export class DeleteTagUseCase {
  constructor(
    private readonly libraryStore: LibraryStore,
    private readonly videoIndex: MutableVideoIndex,
    private readonly libraryPath: string,
  ) {}

  async execute(tagId: number): Promise<void> {
    if (await this.libraryStore.findTagById(tagId) === null) {
      throw new TagNotFoundError(tagId);
    }

    await this.libraryStore.deleteTag(tagId);
    await reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);
  }
}

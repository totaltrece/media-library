import type { LibraryStore, LibraryTagUsage } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { reloadVideoIndex } from "./reload-video-index.js";
import { TagNameConflictError } from "./tag-name-conflict-error.js";
import { TagNotFoundError } from "./tag-not-found-error.js";

export class RenameTagUseCase {
  constructor(
    private readonly libraryStore: LibraryStore,
    private readonly videoIndex: MutableVideoIndex,
    private readonly libraryPath: string,
  ) {}

  execute(tagId: number, name: string): LibraryTagUsage {
    const tagName = name.trim();

    if (tagName.length === 0) {
      throw new Error("Tag name must not be empty");
    }

    const current = this.libraryStore.findTagById(tagId);

    if (current === null) {
      throw new TagNotFoundError(tagId);
    }

    const conflict = this.libraryStore.findTagByName(tagName);

    if (conflict !== null && conflict.id !== tagId) {
      throw new TagNameConflictError(tagName);
    }

    this.libraryStore.renameTag(tagId, tagName);
    reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);

    const renamed = this.libraryStore.listTagUsages().find((tag) => tag.id === tagId);

    if (renamed === undefined) {
      throw new TagNotFoundError(tagId);
    }

    return renamed;
  }
}

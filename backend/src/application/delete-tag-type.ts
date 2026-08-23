import type { LibraryStore } from "../ports/library-store.js";

import { DefaultTagTypeProtectedError } from "./default-tag-type-protected-error.js";
import { TagTypeInUseError } from "./tag-type-in-use-error.js";
import { TagTypeNotFoundError } from "./tag-type-not-found-error.js";

export class DeleteTagTypeUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  execute(tagTypeId: number): void {
    const current = this.libraryStore.findTagTypeById(tagTypeId);

    if (current === null) {
      throw new TagTypeNotFoundError(tagTypeId);
    }

    if (current.isDefault) {
      throw new DefaultTagTypeProtectedError();
    }

    if (current.tagCount > 0) {
      throw new TagTypeInUseError(current.name);
    }

    this.libraryStore.deleteTagType(tagTypeId);
  }
}

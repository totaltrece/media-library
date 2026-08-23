import type { LibraryStore, LibraryTagType } from "../ports/library-store.js";

import { InvalidTagTypeColorError } from "./invalid-tag-type-color-error.js";
import { TagTypeNameConflictError } from "./tag-type-name-conflict-error.js";
import { normalizeTagTypeColor } from "./tag-type-color.js";

export class CreateTagTypeUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  execute(name: string, color: string): LibraryTagType {
    const typeName = name.trim();

    if (typeName.length === 0) {
      throw new Error("Tag type name must not be empty");
    }

    const normalizedColor = normalizeTagTypeColor(color);

    if (normalizedColor === null) {
      throw new InvalidTagTypeColorError();
    }

    const conflict = this.libraryStore.listTagTypes().find((type) => type.name === typeName);

    if (conflict !== undefined) {
      throw new TagTypeNameConflictError(typeName);
    }

    return this.libraryStore.createTagType(typeName, normalizedColor);
  }
}

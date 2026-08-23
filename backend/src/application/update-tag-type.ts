import type { LibraryStore, LibraryTagType } from "../ports/library-store.js";

import { InvalidTagTypeColorError } from "./invalid-tag-type-color-error.js";
import { TagTypeNameConflictError } from "./tag-type-name-conflict-error.js";
import { TagTypeNotFoundError } from "./tag-type-not-found-error.js";
import { normalizeTagTypeColor } from "./tag-type-color.js";

export class UpdateTagTypeUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  execute(tagTypeId: number, name: string, color: string): LibraryTagType {
    const typeName = name.trim();

    if (typeName.length === 0) {
      throw new Error("Tag type name must not be empty");
    }

    const normalizedColor = normalizeTagTypeColor(color);

    if (normalizedColor === null) {
      throw new InvalidTagTypeColorError();
    }

    const current = this.libraryStore.findTagTypeById(tagTypeId);

    if (current === null) {
      throw new TagTypeNotFoundError(tagTypeId);
    }

    const conflict = this.libraryStore.listTagTypes().find((type) => type.name === typeName);

    if (conflict !== undefined && conflict.id !== tagTypeId) {
      throw new TagTypeNameConflictError(typeName);
    }

    return this.libraryStore.updateTagType(tagTypeId, typeName, normalizedColor);
  }
}

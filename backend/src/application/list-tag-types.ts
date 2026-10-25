import type { LibraryStore, LibraryTagType } from "../ports/library-store.js";

export interface TagTypesResponse {
  count: number;
  types: LibraryTagType[];
}

export class ListTagTypesUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  async execute(): Promise<TagTypesResponse> {
    const types = await this.libraryStore.listTagTypes();

    return {
      count: types.length,
      types,
    };
  }
}

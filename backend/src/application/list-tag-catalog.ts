import type { LibraryStore, LibraryTagUsage } from "../ports/library-store.js";

export interface TagCatalogResponse {
  count: number;
  tags: LibraryTagUsage[];
}

export class ListTagCatalogUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  execute(): TagCatalogResponse {
    const tags = this.libraryStore.listTagUsages();

    return {
      count: tags.length,
      tags,
    };
  }
}

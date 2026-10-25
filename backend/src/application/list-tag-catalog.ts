import type { LibraryStore, LibraryTagUsage } from "../ports/library-store.js";

export interface TagCatalogResponse {
  count: number;
  tags: LibraryTagUsage[];
}

export class ListTagCatalogUseCase {
  constructor(private readonly libraryStore: LibraryStore) {}

  async execute(): Promise<TagCatalogResponse> {
    const tags = await this.libraryStore.listTagUsages();

    return {
      count: tags.length,
      tags,
    };
  }
}

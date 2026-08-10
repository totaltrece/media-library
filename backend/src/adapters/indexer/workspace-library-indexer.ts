import { indexLibrary } from "@media-library/indexer";

import type { LibraryIndexer } from "../../ports/library-indexer.js";

export class WorkspaceLibraryIndexer implements LibraryIndexer {
  constructor(private readonly libraryPath: string) {}

  async index(): Promise<Awaited<ReturnType<typeof indexLibrary>>> {
    return indexLibrary(this.libraryPath);
  }
}

import type { EnsureLibraryMedia, EnsureLibraryMediaResult } from "../src/application/ensure-library-media.js";

export class NoopEnsureLibraryMediaUseCase implements EnsureLibraryMedia {
  async execute(): Promise<EnsureLibraryMediaResult> {
    return {
      processed: 0,
      datesFilled: 0,
      thumbnailsGenerated: 0,
      errors: [],
    };
  }
}

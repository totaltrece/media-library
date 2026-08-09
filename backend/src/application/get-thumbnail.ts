import type { ThumbnailResult, ThumbnailStore } from "../ports/thumbnail-store.js";

export class GetThumbnailUseCase {
  constructor(private readonly thumbnailStore: ThumbnailStore) {}

  async execute(mediaId: string): Promise<ThumbnailResult | null> {
    return this.thumbnailStore.getThumbnail(mediaId);
  }
}

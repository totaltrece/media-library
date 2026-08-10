export interface ThumbnailResult {
  data: Buffer;
  contentType: string;
}

export interface ThumbnailStore {
  getThumbnail(mediaId: string): Promise<ThumbnailResult | null>;
}

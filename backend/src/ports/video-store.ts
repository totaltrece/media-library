export interface VideoMetadata {
  path: string;
  size: number;
  contentType: string;
}

export interface VideoStore {
  getVideo(mediaId: string): Promise<VideoMetadata | null>;
}

import type { VideoMetadata, VideoStore } from "../ports/video-store.js";

export class StreamVideoUseCase {
  constructor(private readonly videoStore: VideoStore) {}

  async execute(mediaId: string): Promise<VideoMetadata | null> {
    return this.videoStore.getVideo(mediaId);
  }
}

export class VideoNotFoundError extends Error {
  readonly videoId: string;

  constructor(videoId: string) {
    super("Video not found");
    this.name = "VideoNotFoundError";
    this.videoId = videoId;
  }
}

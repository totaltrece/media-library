export const PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE = "A video with this name already exists.";

export class VideoAlreadyExistsError extends Error {
  readonly videoId: string;

  constructor(videoId: string) {
    super(PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE);
    this.name = "VideoAlreadyExistsError";
    this.videoId = videoId;
  }
}

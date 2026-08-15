export class InvalidMediaIdError extends Error {
  readonly mediaId: string;

  constructor(mediaId: string) {
    super("Invalid video id");
    this.name = "InvalidMediaIdError";
    this.mediaId = mediaId;
  }
}

export class TagNotFoundError extends Error {
  readonly tagId: number;

  constructor(tagId: number) {
    super("Tag not found");
    this.name = "TagNotFoundError";
    this.tagId = tagId;
  }
}

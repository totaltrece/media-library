export class TagTypeNotFoundError extends Error {
  readonly tagTypeId: number;

  constructor(tagTypeId: number) {
    super("Tag type not found");
    this.name = "TagTypeNotFoundError";
    this.tagTypeId = tagTypeId;
  }
}

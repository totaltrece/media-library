export class TagNameConflictError extends Error {
  readonly tagName: string;

  constructor(tagName: string) {
    super(`Tag name already exists: ${tagName}`);
    this.name = "TagNameConflictError";
    this.tagName = tagName;
  }
}

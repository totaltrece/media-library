export class TagTypeInUseError extends Error {
  readonly tagTypeName: string;

  constructor(tagTypeName: string) {
    super(`Tag type is in use: ${tagTypeName}`);
    this.name = "TagTypeInUseError";
    this.tagTypeName = tagTypeName;
  }
}

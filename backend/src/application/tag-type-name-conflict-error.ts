export class TagTypeNameConflictError extends Error {
  readonly tagTypeName: string;

  constructor(tagTypeName: string) {
    super(`Tag type name already exists: ${tagTypeName}`);
    this.name = "TagTypeNameConflictError";
    this.tagTypeName = tagTypeName;
  }
}

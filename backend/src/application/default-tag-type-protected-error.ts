export class DefaultTagTypeProtectedError extends Error {
  constructor() {
    super("Default tag type cannot be deleted");
    this.name = "DefaultTagTypeProtectedError";
  }
}

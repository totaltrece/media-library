export class InvalidTagTypeColorError extends Error {
  constructor() {
    super("Tag type color must be a hex value such as #93c5fd");
    this.name = "InvalidTagTypeColorError";
  }
}

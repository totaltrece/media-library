export class CannotDeleteAdminUserError extends Error {
  constructor() {
    super("Admin users cannot be deleted from the web UI");
    this.name = "CannotDeleteAdminUserError";
  }
}

export class UsernameConflictError extends Error {
  readonly username: string;

  constructor(username: string) {
    super(`Username already exists: ${username}`);
    this.name = "UsernameConflictError";
    this.username = username;
  }
}

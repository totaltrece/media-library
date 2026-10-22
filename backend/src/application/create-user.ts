import type { AuthRole, AuthStore, AuthUser } from "../ports/auth-store.js";

import { hashPassword } from "./password-hash.js";
import { UsernameConflictError } from "./username-conflict-error.js";

export const MIN_USER_PASSWORD_LENGTH = 8;

export interface CreateUserInput {
  username: string;
  password: string;
  role?: AuthRole;
}

export class CreateUserUseCase {
  constructor(private readonly authStore: AuthStore) {}

  execute(input: CreateUserInput): AuthUser {
    const username = input.username.trim();
    const password = input.password;
    const role = input.role ?? "admin";

    if (username.length === 0) {
      throw new Error("Username must not be empty");
    }

    if (username.length > 64) {
      throw new Error("Username must be 64 characters or fewer");
    }

    if (password.length < MIN_USER_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_USER_PASSWORD_LENGTH} characters`);
    }

    if (role !== "admin" && role !== "view") {
      throw new Error("Role must be either 'admin' or 'view'");
    }

    if (this.authStore.findUserByUsername(username) !== null) {
      throw new UsernameConflictError(username);
    }

    return this.authStore.createUser(username, hashPassword(password), role);
  }
}

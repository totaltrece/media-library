import type { AuthStore, AuthUser } from "../ports/auth-store.js";

import { hashPassword } from "./password-hash.js";
import { UsernameConflictError } from "./username-conflict-error.js";

export const MIN_ADMIN_PASSWORD_LENGTH = 8;

export interface CreateAdminInput {
  username: string;
  password: string;
}

export class CreateAdminUseCase {
  constructor(private readonly authStore: AuthStore) {}

  execute(input: CreateAdminInput): AuthUser {
    const username = input.username.trim();
    const password = input.password;

    if (username.length === 0) {
      throw new Error("Username must not be empty");
    }

    if (username.length > 64) {
      throw new Error("Username must be 64 characters or fewer");
    }

    if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
    }

    if (this.authStore.findUserByUsername(username) !== null) {
      throw new UsernameConflictError(username);
    }

    return this.authStore.createUser(username, hashPassword(password), "admin");
  }
}

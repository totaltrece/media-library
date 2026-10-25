import type { AuthStore, AuthUser } from "../ports/auth-store.js";

import { InvalidCredentialsError } from "./invalid-credentials-error.js";
import { verifyPassword } from "./password-hash.js";
import { createSessionToken, sessionExpiresAt } from "./session-token.js";

export interface LoginResult {
  token: string;
  user: AuthUser;
  expiresAt: Date;
}

export class LoginUseCase {
  constructor(private readonly authStore: AuthStore) {}

  async execute(username: string, password: string, now = new Date()): Promise<LoginResult> {
    const record = await this.authStore.findUserByUsername(username.trim());

    if (record === null || !verifyPassword(password, record.passwordHash)) {
      throw new InvalidCredentialsError();
    }

    const token = createSessionToken();
    const expiresAt = sessionExpiresAt(now);
    await this.authStore.createSession(record.id, token, expiresAt);

    return {
      token,
      user: {
        id: record.id,
        username: record.username,
        role: record.role,
      },
      expiresAt,
    };
  }
}

import type { AuthStore } from "../ports/auth-store.js";

export class LogoutUseCase {
  constructor(private readonly authStore: AuthStore) {}

  async execute(token: string | undefined): Promise<void> {
    if (token === undefined || token.length === 0) {
      return;
    }

    await this.authStore.deleteSession(token);
  }
}

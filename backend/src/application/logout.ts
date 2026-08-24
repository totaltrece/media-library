import type { AuthStore } from "../ports/auth-store.js";

export class LogoutUseCase {
  constructor(private readonly authStore: AuthStore) {}

  execute(token: string | undefined): void {
    if (token === undefined || token.length === 0) {
      return;
    }

    this.authStore.deleteSession(token);
  }
}

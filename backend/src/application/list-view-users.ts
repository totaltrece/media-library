import type { AuthStore, AuthUser } from "../ports/auth-store.js";

export class ListViewUsersUseCase {
  constructor(private readonly authStore: AuthStore) {}

  async execute(): Promise<{ count: number; users: AuthUser[] }> {
    const users = await this.authStore.listUsers("view");

    return {
      count: users.length,
      users,
    };
  }
}

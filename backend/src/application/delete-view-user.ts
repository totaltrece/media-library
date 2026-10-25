import type { AuthStore } from "../ports/auth-store.js";
import { CannotDeleteAdminUserError } from "./cannot-delete-admin-user-error.js";
import { UserNotFoundError } from "./user-not-found-error.js";

export class DeleteViewUserUseCase {
  constructor(private readonly authStore: AuthStore) {}

  async execute(userId: number): Promise<void> {
    const user = await this.authStore.findUserById(userId);

    if (user === null) {
      throw new UserNotFoundError(userId);
    }

    if (user.role !== "view") {
      throw new CannotDeleteAdminUserError();
    }

    await this.authStore.deleteUser(userId);
  }
}

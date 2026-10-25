import assert from "node:assert/strict";
import { test } from "node:test";

import { CreateUserUseCase } from "../src/application/create-user.js";
import { LoginUseCase } from "../src/application/login.js";
import { LogoutUseCase } from "../src/application/logout.js";
import { hashPassword } from "../src/application/password-hash.js";
import { UsernameConflictError } from "../src/application/username-conflict-error.js";
import type { AuthStore } from "../src/ports/auth-store.js";

export interface AuthStoreHarness {
  authStore: AuthStore;
  close(): Promise<void>;
}

export function defineAuthStoreContract(engine: string, openStores: () => Promise<AuthStoreHarness>): void {
  async function withStores(run: (authStore: AuthStore) => Promise<void>): Promise<void> {
    const stores = await openStores();

    try {
      await run(stores.authStore);
    } finally {
      await stores.close();
    }
  }

  test(`${engine}: create-user inserts a unique hashed admin and refuses duplicates`, async () => {
    await withStores(async (authStore) => {
      const created = await new CreateUserUseCase(authStore).execute({
        username: "  admin  ",
        password: "password1",
      });

      assert.equal(created.username, "admin");
      assert.equal(created.role, "admin");

      const stored = await authStore.findUserByUsername("admin");
      assert.notEqual(stored, null);
      assert.match(stored?.passwordHash ?? "", /^scrypt\$/);

      await assert.rejects(
        async () => new CreateUserUseCase(authStore).execute({ username: "admin", password: "password1" }),
        UsernameConflictError,
      );
    });
  });

  test(`${engine}: sessions can be created, resolved, and deleted`, async () => {
    await withStores(async (authStore) => {
      const user = await authStore.createUser("admin", hashPassword("password1"), "admin");
      const login = await new LoginUseCase(authStore).execute("admin", "password1");
      const session = await authStore.findValidSession(login.token);

      assert.notEqual(session, null);
      assert.equal(session?.user.id, user.id);

      await new LogoutUseCase(authStore).execute(login.token);
      assert.equal(await authStore.findValidSession(login.token), null);
    });
  });

  test(`${engine}: listUsers can filter view accounts and deleteUser removes them`, async () => {
    await withStores(async (authStore) => {
      await authStore.createUser("admin", hashPassword("password1"), "admin");
      const viewer = await authStore.createUser("viewer", hashPassword("password1"), "view");

      assert.deepEqual(
        (await authStore.listUsers("view")).map((user) => user.username),
        ["viewer"],
      );

      await authStore.deleteUser(viewer.id);
      assert.equal(await authStore.findUserById(viewer.id), null);
      assert.equal((await authStore.listUsers("view")).length, 0);
      assert.notEqual(await authStore.findUserByUsername("admin"), null);
    });
  });

  test(`${engine}: expired sessions are not valid`, async () => {
    await withStores(async (authStore) => {
      const user = await authStore.createUser("admin", hashPassword("password1"), "admin");
      const token = "a".repeat(64);
      await authStore.createSession(user.id, token, new Date("2020-01-01T00:00:00.000Z"));

      assert.equal(await authStore.findValidSession(token, new Date("2026-01-01T00:00:00.000Z")), null);
    });
  });
}

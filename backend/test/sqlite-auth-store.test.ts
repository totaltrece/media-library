import assert from "node:assert/strict";
import { test } from "node:test";

import { openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { CreateUserUseCase } from "../src/application/create-user.js";
import { LoginUseCase } from "../src/application/login.js";
import { LogoutUseCase } from "../src/application/logout.js";
import { hashPassword } from "../src/application/password-hash.js";
import { UsernameConflictError } from "../src/application/username-conflict-error.js";

test("create-user inserts a unique hashed admin and refuses duplicates", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    const created = await new CreateUserUseCase(stores.authStore).execute({
      username: "  admin  ",
      password: "password1",
    });

    assert.equal(created.username, "admin");
    assert.equal(created.role, "admin");

    const stored = await stores.authStore.findUserByUsername("admin");
    assert.notEqual(stored, null);
    assert.notEqual(stored?.passwordHash, "password1");
    assert.match(stored?.passwordHash ?? "", /^scrypt\$/);

    await assert.rejects(async () => new CreateUserUseCase(stores.authStore).execute({ username: "admin", password: "password1" }),
      UsernameConflictError,
    );
  } finally {
    await stores.close();
  }
});

test("sessions can be created, resolved, and deleted", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    const user = await stores.authStore.createUser("admin", hashPassword("password1"), "admin");
    const login = await new LoginUseCase(stores.authStore).execute("admin", "password1");

    const session = await stores.authStore.findValidSession(login.token);
    assert.notEqual(session, null);
    assert.equal(session?.user.id, user.id);
    assert.equal(session?.user.username, "admin");

    await new LogoutUseCase(stores.authStore).execute(login.token);
    assert.equal(await stores.authStore.findValidSession(login.token), null);
  } finally {
    await stores.close();
  }
});

test("expired sessions are not valid", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    const user = await stores.authStore.createUser("admin", hashPassword("password1"), "admin");
    const token = "a".repeat(64);
    const expiredAt = new Date("2020-01-01T00:00:00.000Z");
    await stores.authStore.createSession(user.id, token, expiredAt);

    assert.equal(await stores.authStore.findValidSession(token, new Date("2026-01-01T00:00:00.000Z")), null);
  } finally {
    await stores.close();
  }
});

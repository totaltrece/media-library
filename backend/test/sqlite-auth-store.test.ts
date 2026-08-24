import assert from "node:assert/strict";
import { test } from "node:test";

import { openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { CreateAdminUseCase } from "../src/application/create-admin.js";
import { LoginUseCase } from "../src/application/login.js";
import { LogoutUseCase } from "../src/application/logout.js";
import { hashPassword } from "../src/application/password-hash.js";
import { UsernameConflictError } from "../src/application/username-conflict-error.js";

test("create-admin inserts a unique hashed admin and refuses duplicates", () => {
  const stores = openSqliteStores(":memory:");

  try {
    const created = new CreateAdminUseCase(stores.authStore).execute({
      username: "  admin  ",
      password: "password1",
    });

    assert.equal(created.username, "admin");
    assert.equal(created.role, "admin");

    const stored = stores.authStore.findUserByUsername("admin");
    assert.notEqual(stored, null);
    assert.notEqual(stored?.passwordHash, "password1");
    assert.match(stored?.passwordHash ?? "", /^scrypt\$/);

    assert.throws(
      () => new CreateAdminUseCase(stores.authStore).execute({ username: "admin", password: "password1" }),
      UsernameConflictError,
    );
  } finally {
    stores.close();
  }
});

test("sessions can be created, resolved, and deleted", () => {
  const stores = openSqliteStores(":memory:");

  try {
    const user = stores.authStore.createUser("admin", hashPassword("password1"), "admin");
    const login = new LoginUseCase(stores.authStore).execute("admin", "password1");

    const session = stores.authStore.findValidSession(login.token);
    assert.notEqual(session, null);
    assert.equal(session?.user.id, user.id);
    assert.equal(session?.user.username, "admin");

    new LogoutUseCase(stores.authStore).execute(login.token);
    assert.equal(stores.authStore.findValidSession(login.token), null);
  } finally {
    stores.close();
  }
});

test("expired sessions are not valid", () => {
  const stores = openSqliteStores(":memory:");

  try {
    const user = stores.authStore.createUser("admin", hashPassword("password1"), "admin");
    const token = "a".repeat(64);
    const expiredAt = new Date("2020-01-01T00:00:00.000Z");
    stores.authStore.createSession(user.id, token, expiredAt);

    assert.equal(stores.authStore.findValidSession(token, new Date("2026-01-01T00:00:00.000Z")), null);
  } finally {
    stores.close();
  }
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { SESSION_COOKIE_NAME } from "../src/adapters/http/session-cookie.js";
import { openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { CreateUserUseCase } from "../src/application/create-user.js";
import { DeleteViewUserUseCase } from "../src/application/delete-view-user.js";
import { CannotDeleteAdminUserError } from "../src/application/cannot-delete-admin-user-error.js";
import { hashPassword } from "../src/application/password-hash.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import { testLibraryPath } from "./fixtures.js";

const ADMIN_PASSWORD = "password1";

async function createUsersApp() {
  const stores = openSqliteStores(":memory:");
  await new CreateUserUseCase(stores.authStore).execute({ username: "admin", password: ADMIN_PASSWORD });
  const videoIndex = new InMemoryVideoIndex(
    toIndexedVideos(await stores.libraryStore.listVideosWithTags(), testLibraryPath),
  );
  const app = await createApp({
    videoIndex,
    libraryPath: testLibraryPath,
    libraryStore: stores.libraryStore,
    authStore: stores.authStore,
    authPublicRead: false,
  });

  return { app, stores };
}

function cookieHeader(token: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

function sessionToken(response: { cookies: Array<{ name: string; value: string }> }): string {
  const cookie = response.cookies.find((entry) => entry.name === SESSION_COOKIE_NAME);
  assert.ok(cookie, "expected a session cookie");
  return cookie.value;
}

test("admin can list, create, and delete view users", async () => {
  const { app, stores } = await createUsersApp();

  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    const headers = cookieHeader(sessionToken(login));

    const created = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers,
      payload: { username: "guest", password: "password1" },
    });
    assert.strictEqual(created.statusCode, 201);
    assert.equal(created.json().username, "guest");
    assert.equal(created.json().role, "view");
    const guestId = created.json().id as number;

    const listed = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers,
    });
    assert.strictEqual(listed.statusCode, 200);
    assert.deepEqual(
      listed.json().users.map((user: { username: string; role: string }) => ({
        username: user.username,
        role: user.role,
      })),
      [{ username: "guest", role: "view" }],
    );

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/admin/users/${guestId}`,
      headers,
    });
    assert.strictEqual(deleted.statusCode, 200);
    assert.equal(await stores.authStore.findUserById(guestId), null);
  } finally {
    await app.close();
    await stores.close();
  }
});

test("view users cannot list or create users", async () => {
  const { app, stores } = await createUsersApp();

  try {
    await stores.authStore.createUser("viewer", hashPassword(ADMIN_PASSWORD), "view");
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "viewer", password: ADMIN_PASSWORD },
    });
    const headers = cookieHeader(sessionToken(login));

    const listed = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers,
    });
    assert.strictEqual(listed.statusCode, 403);

    const created = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers,
      payload: { username: "other", password: "password1" },
    });
    assert.strictEqual(created.statusCode, 403);
  } finally {
    await app.close();
    await stores.close();
  }
});

test("HTTP user create always assigns the view role", async () => {
  const { app, stores } = await createUsersApp();

  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: cookieHeader(sessionToken(login)),
      payload: { username: "guest", password: "password1", role: "admin" },
    });
    assert.strictEqual(created.statusCode, 201);
    assert.equal(created.json().role, "view");
  } finally {
    await app.close();
    await stores.close();
  }
});

test("DeleteViewUserUseCase refuses admin accounts", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    const admin = await new CreateUserUseCase(stores.authStore).execute({
      username: "admin",
      password: ADMIN_PASSWORD,
    });
    await assert.rejects(
      async () => new DeleteViewUserUseCase(stores.authStore).execute(admin.id),
      CannotDeleteAdminUserError,
    );
  } finally {
    await stores.close();
  }
});

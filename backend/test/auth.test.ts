import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { CreateAdminUseCase } from "../src/application/create-admin.js";
import { hashPassword } from "../src/application/password-hash.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import type { AuthStore } from "../src/ports/auth-store.js";
import type { LibraryStore } from "../src/ports/library-store.js";

import { SESSION_COOKIE_NAME } from "../src/adapters/http/session-cookie.js";
import { testLibraryPath } from "./fixtures.js";

const ADMIN_PASSWORD = "password1";

async function createAuthApp(options: {
  libraryStore: LibraryStore;
  authStore: AuthStore;
  publicRead?: boolean;
}) {
  const videoIndex = new InMemoryVideoIndex(
    toIndexedVideos(options.libraryStore.listVideosWithTags(), testLibraryPath),
  );

  return createApp({
    videoIndex,
    libraryPath: testLibraryPath,
    libraryStore: options.libraryStore,
    authStore: options.authStore,
    authPublicRead: options.publicRead,
  });
}

function cookieHeader(token: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

function sessionTokenFromResponse(response: { cookies: Array<{ name: string; value: string }> }): string {
  const cookie = response.cookies.find((entry) => entry.name === SESSION_COOKIE_NAME);
  assert.ok(cookie, "expected a session cookie");
  return cookie.value;
}

test("POST /api/auth/login sets a session cookie and GET /me returns the user", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    new CreateAdminUseCase(stores.authStore).execute({ username: "admin", password: ADMIN_PASSWORD });
    const app = await createAuthApp(stores);

    const failed = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "wrong-password" },
    });
    assert.strictEqual(failed.statusCode, 401);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    assert.strictEqual(login.statusCode, 200);
    assert.deepEqual(login.json(), { authenticated: true, username: "admin", role: "admin" });
    const token = sessionTokenFromResponse(login);

    const anonymousMe = await app.inject({
      method: "GET",
      url: "/api/auth/me",
    });
    assert.strictEqual(anonymousMe.statusCode, 200);
    assert.deepEqual(anonymousMe.json(), { authenticated: false });

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(token),
    });
    assert.strictEqual(me.statusCode, 200);
    assert.deepEqual(me.json(), { authenticated: true, username: "admin", role: "admin" });

    const logout = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: cookieHeader(token),
    });
    assert.strictEqual(logout.statusCode, 200);
    assert.deepEqual(logout.json(), { authenticated: false });

    const afterLogout = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: cookieHeader(token),
    });
    assert.deepEqual(afterLogout.json(), { authenticated: false });

    await app.close();
  } finally {
    stores.close();
  }
});

test("mutating routes require an admin session", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    new CreateAdminUseCase(stores.authStore).execute({ username: "admin", password: ADMIN_PASSWORD });
    stores.authStore.createUser("viewer", hashPassword(ADMIN_PASSWORD), "view");
    const app = await createAuthApp(stores);

    const anonymous = await app.inject({
      method: "POST",
      url: "/api/admin/tag-types",
      payload: { name: "workshop", color: "#112233" },
    });
    assert.strictEqual(anonymous.statusCode, 401);

    const viewerLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "viewer", password: ADMIN_PASSWORD },
    });
    const viewerToken = sessionTokenFromResponse(viewerLogin);
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/admin/tag-types",
      headers: cookieHeader(viewerToken),
      payload: { name: "workshop", color: "#112233" },
    });
    assert.strictEqual(forbidden.statusCode, 403);

    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    const adminToken = sessionTokenFromResponse(adminLogin);
    const created = await app.inject({
      method: "POST",
      url: "/api/admin/tag-types",
      headers: cookieHeader(adminToken),
      payload: { name: "workshop", color: "#112233" },
    });
    assert.strictEqual(created.statusCode, 201);
    assert.equal(created.json().name, "workshop");

    const publicGet = await app.inject({
      method: "GET",
      url: "/api/admin/tag-types",
    });
    assert.strictEqual(publicGet.statusCode, 200);

    await app.close();
  } finally {
    stores.close();
  }
});

test("GET requires a session when public-read is off", async () => {
  const stores = openSqliteStores(":memory:");

  try {
    new CreateAdminUseCase(stores.authStore).execute({ username: "admin", password: ADMIN_PASSWORD });
    const app = await createAuthApp({ ...stores, publicRead: false });

    const anonymous = await app.inject({
      method: "GET",
      url: "/api/tags",
    });
    assert.strictEqual(anonymous.statusCode, 401);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    const allowed = await app.inject({
      method: "GET",
      url: "/api/tags",
      headers: cookieHeader(sessionTokenFromResponse(login)),
    });
    assert.strictEqual(allowed.statusCode, 200);

    await app.close();
  } finally {
    stores.close();
  }
});

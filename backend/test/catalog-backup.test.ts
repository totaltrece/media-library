import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { SESSION_COOKIE_NAME } from "../src/adapters/http/session-cookie.js";
import {
  readSqliteCatalogDump,
  writeSqliteCatalogDump,
  type SqliteCatalogDump,
} from "../src/adapters/sqlite/sqlite-catalog-dump.js";
import { openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { BackupCatalogUseCase } from "../src/application/backup-catalog.js";
import { BackupNotSupportedError } from "../src/application/backup-not-supported-error.js";
import { CreateUserUseCase } from "../src/application/create-user.js";
import { hashPassword } from "../src/application/password-hash.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import type { CatalogBackupPort } from "../src/ports/catalog-backup.js";
import { testLibraryPath } from "./fixtures.js";

const ADMIN_PASSWORD = "password1";
const sampleDump: SqliteCatalogDump = {
  tagTypes: [{ id: 1, name: "type", color: "#c0392b", is_default: 0, sort_order: 1 }],
  tags: [{ id: 1, name: "salsa", tag_type_id: 1 }],
  videos: [{ id: "clip.mp4", recorded_at: null }],
  videoTags: [{ video_id: "clip.mp4", tag_id: 1, position: 0 }],
  users: [
    {
      id: 1,
      username: "admin",
      password_hash: "hash",
      role: "admin",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ],
};

test("writeSqliteCatalogDump replaces the SQLite file with the dump", () => {
  const directory = mkdtempSync(join(tmpdir(), "media-library-backup-"));
  const sqlitePath = join(directory, "library.sqlite");

  try {
    writeSqliteCatalogDump(sqlitePath, sampleDump);
    writeSqliteCatalogDump(sqlitePath, {
      ...sampleDump,
      videos: [{ id: "other.mp4", recorded_at: "2024-01-02T00:00:00.000Z" }],
      videoTags: [{ video_id: "other.mp4", tag_id: 1, position: 0 }],
    });

    const dump = readSqliteCatalogDump(sqlitePath);
    assert.deepEqual(
      dump.videos.map((row) => row.id),
      ["other.mp4"],
    );
    assert.equal(dump.users[0]?.username, "admin");
    assert.equal(dump.tagTypes.length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("BackupCatalogUseCase requires SQLITE_PATH", async () => {
  const backup: CatalogBackupPort = {
    backupToSqlite: async () => {
      throw new Error("should not run");
    },
  };

  await assert.rejects(
    () => new BackupCatalogUseCase(backup, undefined).execute(),
    BackupNotSupportedError,
  );
});

test("admin can request a catalog backup when a port is wired", async () => {
  const stores = openSqliteStores(":memory:");
  await new CreateUserUseCase(stores.authStore).execute({ username: "admin", password: ADMIN_PASSWORD });
  const sqlitePath = join(tmpdir(), "wired-backup.sqlite");
  const backup: CatalogBackupPort = {
    async backupToSqlite(path) {
      return {
        sqlitePath: path,
        tagTypes: 5,
        tags: 1,
        videos: 2,
        relations: 3,
        users: 1,
      };
    },
  };
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(
      toIndexedVideos(await stores.libraryStore.listVideosWithTags(), testLibraryPath),
    ),
    libraryPath: testLibraryPath,
    libraryStore: stores.libraryStore,
    authStore: stores.authStore,
    catalogBackup: backup,
    sqlitePath,
    authPublicRead: false,
  });

  try {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    const cookie = login.cookies.find((entry) => entry.name === SESSION_COOKIE_NAME);
    assert.ok(cookie);

    const response = await app.inject({
      method: "POST",
      url: "/api/admin/backup",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${cookie.value}` },
    });
    assert.strictEqual(response.statusCode, 200);
    assert.equal(response.json().videos, 2);
    assert.equal(response.json().sqlitePath, sqlitePath);
  } finally {
    await app.close();
    await stores.close();
  }
});

test("SQLite engine backup is rejected and view users cannot call it", async () => {
  const stores = openSqliteStores(":memory:");
  await new CreateUserUseCase(stores.authStore).execute({ username: "admin", password: ADMIN_PASSWORD });
  await stores.authStore.createUser("viewer", hashPassword(ADMIN_PASSWORD), "view");
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(
      toIndexedVideos(await stores.libraryStore.listVideosWithTags(), testLibraryPath),
    ),
    libraryPath: testLibraryPath,
    libraryStore: stores.libraryStore,
    authStore: stores.authStore,
    sqlitePath: ":memory:",
    authPublicRead: false,
  });

  try {
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: ADMIN_PASSWORD },
    });
    const adminCookie = adminLogin.cookies.find((entry) => entry.name === SESSION_COOKIE_NAME);
    assert.ok(adminCookie);
    const unsupported = await app.inject({
      method: "POST",
      url: "/api/admin/backup",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${adminCookie.value}` },
    });
    assert.strictEqual(unsupported.statusCode, 409);

    const viewLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "viewer", password: ADMIN_PASSWORD },
    });
    const viewCookie = viewLogin.cookies.find((entry) => entry.name === SESSION_COOKIE_NAME);
    assert.ok(viewCookie);
    const forbidden = await app.inject({
      method: "POST",
      url: "/api/admin/backup",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${viewCookie.value}` },
    });
    assert.strictEqual(forbidden.statusCode, 403);
  } finally {
    await app.close();
    await stores.close();
  }
});

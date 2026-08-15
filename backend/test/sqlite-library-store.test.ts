import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  applySqliteMigrations,
  openSqliteLibraryStore,
} from "../src/adapters/sqlite/sqlite-library-store.js";

test("openSqliteLibraryStore initializes the schema on a file database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-sqlite-"));
  const databasePath = join(directory, "library.sqlite");
  const store = openSqliteLibraryStore(databasePath);

  try {
    store.upsertVideo("salsa/first.mp4");
    store.upsertTag("salsa");

    assert.deepEqual(store.listVideos(), [{ id: "salsa/first.mp4" }]);
    assert.deepEqual(store.listTags().map((tag) => tag.name), ["salsa"]);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("schema migrations are idempotent", () => {
  const database = new DatabaseSync(":memory:");

  applySqliteMigrations(database);
  applySqliteMigrations(database);

  const versions = database
    .prepare("SELECT version FROM schema_migrations")
    .all()
    .map((row) => (row as { version: number }).version);

  assert.deepEqual(versions, [1]);

  database.close();
});

test("videos can be upserted without creating duplicates", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const first = store.upsertVideo("salsa/first.mp4");
    const second = store.upsertVideo("salsa/first.mp4");

    assert.deepEqual(first, second);
    assert.deepEqual(store.listVideos(), [{ id: "salsa/first.mp4" }]);
  } finally {
    store.close();
  }
});

test("tags keep their original names and reject exact duplicates", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const salsa = store.upsertTag("salsa");
    const sameSalsa = store.upsertTag("salsa");
    const capitalized = store.upsertTag("Salsa");

    assert.strictEqual(salsa.id, sameSalsa.id);
    assert.notEqual(capitalized.id, salsa.id);
    assert.deepEqual(
      store.listTags().map((tag) => tag.name),
      ["Salsa", "salsa"],
    );
  } finally {
    store.close();
  }
});

test("video tags preserve order and replace previous assignments", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    store.upsertVideo("salsa/first.mp4");
    store.setVideoTags("salsa/first.mp4", ["salsa", "bea", "linea"]);
    store.setVideoTags("salsa/first.mp4", ["bea", "salsa"]);

    assert.deepEqual(store.getVideoTags("salsa/first.mp4"), ["bea", "salsa"]);
    assert.deepEqual(store.listVideosWithTags(), [
      {
        id: "salsa/first.mp4",
        tags: ["bea", "salsa"],
      },
    ]);
  } finally {
    store.close();
  }
});

test("video ids are unique", () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4");

  assert.throws(
    () => database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4"),
    /UNIQUE constraint failed: videos\.id/,
  );

  database.close();
});

test("tag names are unique", () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa");

  assert.throws(
    () => database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa"),
    /UNIQUE constraint failed: tags\.name/,
  );

  database.close();
});

test("video_tags require an existing video and tag", () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa");
  const tag = database.prepare("SELECT id FROM tags WHERE name = ?").get("salsa") as { id: number };

  assert.throws(
    () =>
      database
        .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
        .run("missing.mp4", tag.id, 0),
    /FOREIGN KEY constraint failed/,
  );

  database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4");

  assert.throws(
    () =>
      database
        .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
        .run("salsa/first.mp4", 999, 0),
    /FOREIGN KEY constraint failed/,
  );

  database.close();
});

test("video_tags reject duplicate video/tag pairs", () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa");
  const tag = database.prepare("SELECT id FROM tags WHERE name = ?").get("salsa") as { id: number };

  database
    .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
    .run("salsa/first.mp4", tag.id, 0);

  assert.throws(
    () =>
      database
        .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
        .run("salsa/first.mp4", tag.id, 1),
    /UNIQUE constraint failed: video_tags\.video_id, video_tags\.tag_id/,
  );

  database.close();
});

test("deleting a video removes its tag relations", () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa");
  const tag = database.prepare("SELECT id FROM tags WHERE name = ?").get("salsa") as { id: number };

  database
    .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
    .run("salsa/first.mp4", tag.id, 0);

  database.prepare("DELETE FROM videos WHERE id = ?").run("salsa/first.mp4");

  assert.deepEqual(database.prepare("SELECT video_id FROM video_tags").all(), []);
  assert.deepEqual(
    database
      .prepare("SELECT name FROM tags")
      .all()
      .map((row) => (row as { name: string }).name),
    ["salsa"],
  );

  database.close();
});

test("empty video ids and tag names are rejected", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    assert.throws(() => store.upsertVideo(""), /Video id must not be empty/);
    assert.throws(() => store.upsertTag(""), /Tag name must not be empty/);
  } finally {
    store.close();
  }
});

test("addVideoTag appends a new tag without changing existing order", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    store.upsertVideo("salsa/first.mp4");
    store.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota"]);
    store.addVideoTag("salsa/first.mp4", "bufanda");
    store.addVideoTag("salsa/first.mp4", "bufanda");

    assert.deepEqual(store.getVideoTags("salsa/first.mp4"), ["salsa", "isa", "jota", "bufanda"]);
  } finally {
    store.close();
  }
});

test("addVideoTag creates a catalog tag when it does not exist", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    store.upsertVideo("salsa/first.mp4");
    store.addVideoTag("salsa/first.mp4", "bufanda");

    assert.deepEqual(store.listTags().map((tag) => tag.name), ["bufanda"]);
  } finally {
    store.close();
  }
});

test("removeVideoTag keeps remaining tags in order and leaves the catalog intact", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    store.upsertVideo("salsa/first.mp4");
    store.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota", "bufanda"]);
    store.removeVideoTag("salsa/first.mp4", "isa");
    store.removeVideoTag("salsa/first.mp4", "missing");

    assert.deepEqual(store.getVideoTags("salsa/first.mp4"), ["salsa", "jota", "bufanda"]);
    assert.deepEqual(
      store.listTags().map((tag) => tag.name),
      ["bufanda", "isa", "jota", "salsa"],
    );
  } finally {
    store.close();
  }
});

test("addVideoTag and setVideoTags reject missing videos", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    assert.throws(() => store.addVideoTag("missing.mp4", "salsa"), /Video not found: missing.mp4/);
    assert.throws(() => store.removeVideoTag("missing.mp4", "salsa"), /Video not found: missing.mp4/);
    assert.throws(() => store.setVideoTags("missing.mp4", ["salsa"]), /Video not found: missing.mp4/);
  } finally {
    store.close();
  }
});

test("setVideoTags rolls back when a later tag is invalid", () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    store.upsertVideo("salsa/first.mp4");
    store.setVideoTags("salsa/first.mp4", ["salsa", "isa"]);

    assert.throws(() => store.setVideoTags("salsa/first.mp4", ["jota", ""]), /Tag name must not be empty/);
    assert.deepEqual(store.getVideoTags("salsa/first.mp4"), ["salsa", "isa"]);
    assert.equal(store.findTagByName("jota"), null);
  } finally {
    store.close();
  }
});

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
import { sqliteMigrations } from "../src/adapters/sqlite/migrations.js";
import type { LibraryStore } from "../src/ports/library-store.js";

async function assignTagType(store: LibraryStore, tagName: string, typeName: string): Promise<void> {
  const tag = await store.findTagByName(tagName);
  const type = (await store.listTagTypes()).find((item) => item.name === typeName);

  if (tag === null || type === undefined) {
    throw new Error(`Unable to assign ${tagName} to ${typeName}`);
  }

  await store.updateTag(tag.id, tag.name, type.id);
}

test("openSqliteLibraryStore initializes the schema on a file database", async () => {
  const directory = await mkdtemp(join(tmpdir(), "media-library-sqlite-"));
  const databasePath = join(directory, "library.sqlite");
  const store = openSqliteLibraryStore(databasePath);

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.upsertTag("salsa");

    assert.deepEqual(await store.listVideos(), [{ id: "salsa/first.mp4", recordedAt: null }]);
    assert.deepEqual((await store.listTags()).map((tag) => tag.name), ["salsa"]);
  } finally {
    await store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("schema migrations are idempotent", async () => {
  const database = new DatabaseSync(":memory:");

  applySqliteMigrations(database);
  applySqliteMigrations(database);

  const versions = database
    .prepare("SELECT version FROM schema_migrations")
    .all()
    .map((row) => (row as { version: number }).version);

  assert.deepEqual(versions, [1, 2, 3, 4]);

  database.close();
});

test("videos can be upserted without creating duplicates", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const first = await store.upsertVideo("salsa/first.mp4");
    const second = await store.upsertVideo("salsa/first.mp4");

    assert.deepEqual(first, second);
    assert.deepEqual(await store.listVideos(), [{ id: "salsa/first.mp4", recordedAt: null }]);
  } finally {
    await store.close();
  }
});

test("tags keep their original names and reject exact duplicates", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const salsa = await store.upsertTag("salsa");
    const sameSalsa = await store.upsertTag("salsa");
    const capitalized = await store.upsertTag("Salsa");

    assert.strictEqual(salsa.id, sameSalsa.id);
    assert.notEqual(capitalized.id, salsa.id);
    assert.deepEqual(
      (await store.listTags()).map((tag) => tag.name),
      ["Salsa", "salsa"],
    );
  } finally {
    await store.close();
  }
});

test("video tags are listed by type then name", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.setVideoTags("salsa/first.mp4", ["isa", "bufanda", "salsa", "linea"]);
    await assignTagType(store, "salsa", "type");
    await assignTagType(store, "linea", "style");
    await assignTagType(store, "isa", "teacher");

    assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["salsa", "linea", "isa", "bufanda"]);
    assert.deepEqual(await store.listVideosWithTags(), [
      {
        id: "salsa/first.mp4",
        recordedAt: null,
        tags: ["salsa", "linea", "isa", "bufanda"],
      },
    ]);
  } finally {
    await store.close();
  }
});

test("video ids are unique", async () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4");

  assert.throws(
    () => database.prepare("INSERT INTO videos (id) VALUES (?)").run("salsa/first.mp4"),
    /UNIQUE constraint failed: videos\.id/,
  );

  database.close();
});

test("tag names are unique", async () => {
  const database = new DatabaseSync(":memory:");
  applySqliteMigrations(database);

  database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa");

  assert.throws(
    () => database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa"),
    /UNIQUE constraint failed: tags\.name/,
  );

  database.close();
});

test("video_tags require an existing video and tag", async () => {
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

test("video_tags reject duplicate video/tag pairs", async () => {
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

test("deleteVideo removes the video and its tag relations without deleting tags", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.upsertVideo("salsa/second.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    await store.setVideoTags("salsa/second.mp4", ["salsa"]);
    await store.upsertTag("bufanda");

    await store.deleteVideo("salsa/first.mp4");

    assert.equal(await store.findVideo("salsa/first.mp4"), null);
    assert.deepEqual((await store.listVideos()).map((video) => video.id), ["salsa/second.mp4"]);
    assert.deepEqual(await store.getVideoTags("salsa/second.mp4"), ["salsa"]);
    assert.deepEqual(
      (await store.listTags()).map((tag) => tag.name),
      ["bufanda", "jota", "salsa"],
    );
    await assert.rejects(async () => store.deleteVideo("salsa/first.mp4"), /Video not found: salsa\/first.mp4/);
  } finally {
    await store.close();
  }
});

test("deleting a video removes its tag relations", async () => {
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

test("empty video ids and tag names are rejected", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await assert.rejects(async () => store.upsertVideo(""), /Video id must not be empty/);
    await assert.rejects(async () => store.upsertTag(""), /Tag name must not be empty/);
  } finally {
    await store.close();
  }
});

test("addVideoTag appends a new tag without duplicating it", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota"]);
    await store.addVideoTag("salsa/first.mp4", "bufanda");
    await store.addVideoTag("salsa/first.mp4", "bufanda");

    assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["bufanda", "isa", "jota", "salsa"]);
  } finally {
    await store.close();
  }
});

test("addVideoTag creates a catalog tag when it does not exist", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.addVideoTag("salsa/first.mp4", "bufanda");

    assert.deepEqual((await store.listTags()).map((tag) => tag.name), ["bufanda"]);
  } finally {
    await store.close();
  }
});

test("removeVideoTag keeps remaining tags in order and leaves the catalog intact", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota", "bufanda"]);
    await store.removeVideoTag("salsa/first.mp4", "isa");
    await store.removeVideoTag("salsa/first.mp4", "missing");

    assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["bufanda", "jota", "salsa"]);
    assert.deepEqual(
      (await store.listTags()).map((tag) => tag.name),
      ["bufanda", "isa", "jota", "salsa"],
    );
  } finally {
    await store.close();
  }
});

test("addVideoTag and setVideoTags reject missing videos", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await assert.rejects(async () => store.addVideoTag("missing.mp4", "salsa"), /Video not found: missing.mp4/);
    await assert.rejects(async () => store.removeVideoTag("missing.mp4", "salsa"), /Video not found: missing.mp4/);
    await assert.rejects(async () => store.setVideoTags("missing.mp4", ["salsa"]), /Video not found: missing.mp4/);
  } finally {
    await store.close();
  }
});

test("setVideoTags rolls back when a later tag is invalid", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "isa"]);

    await assert.rejects(async () => store.setVideoTags("salsa/first.mp4", ["jota", ""]), /Tag name must not be empty/);
    assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["isa", "salsa"]);
    assert.equal(await store.findTagByName("jota"), null);
  } finally {
    await store.close();
  }
});

test("listTagUsages includes unused tags with a zero count", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    await store.upsertTag("bufanda");

    assert.deepEqual(await store.listTagUsages(), [
      { ...(await store.findTagByName("bufanda"))!, usageCount: 0 },
      { ...(await store.findTagByName("jota"))!, usageCount: 1 },
      { ...(await store.findTagByName("salsa"))!, usageCount: 1 },
    ]);
  } finally {
    await store.close();
  }
});

test("updateTag changes the name and keeps the same id and video relations", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    const jota = (await store.findTagByName("jota"))!;
    const teacher = (await store.listTagTypes()).find((type) => type.name === "teacher")!;

    const renamed = await store.updateTag(jota.id, "jota-nueva", teacher.id);

    assert.strictEqual(renamed.id, jota.id);
    assert.strictEqual(renamed.name, "jota-nueva");
    assert.strictEqual(renamed.typeId, teacher.id);
    assert.equal(await store.findTagByName("jota"), null);
    assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["jota-nueva", "salsa"]);
  } finally {
    await store.close();
  }
});

test("updateTag rejects empty names, missing types, and existing names", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const salsa = await store.upsertTag("salsa");
    await store.upsertTag("jota");
    const resource = (await store.findDefaultTagType())!;

    await assert.rejects(async () => store.updateTag(salsa.id, "", resource.id), /Tag name must not be empty/);
    await assert.rejects(async () => store.updateTag(salsa.id, "jota", resource.id), /Tag name already exists: jota/);
    await assert.rejects(async () => store.updateTag(999, "nuevo", resource.id), /Tag not found: 999/);
    await assert.rejects(async () => store.updateTag(salsa.id, "salsa", 999), /Tag type not found: 999/);
    assert.deepEqual((await store.listTags()).map((tag) => tag.name), ["jota", "salsa"]);
  } finally {
    await store.close();
  }
});

test("deleteTag removes the catalog entry and its video relations", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    await store.upsertVideo("salsa/first.mp4");
    await store.upsertVideo("salsa/second.mp4");
    await store.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    await store.setVideoTags("salsa/second.mp4", ["salsa"]);
    const jota = (await store.findTagByName("jota"))!;
    const salsa = (await store.findTagByName("salsa"))!;

    await store.deleteTag(jota.id);

    assert.equal(await store.findTagById(jota.id), null);
    assert.deepEqual(await store.getVideoTags("salsa/first.mp4"), ["salsa"]);
    assert.deepEqual(await store.getVideoTags("salsa/second.mp4"), ["salsa"]);
    assert.deepEqual((await store.listVideos()).map((video) => video.id), ["salsa/first.mp4", "salsa/second.mp4"]);
    assert.deepEqual(await store.findTagById(salsa.id), salsa);
    await assert.rejects(async () => store.deleteTag(999), /Tag not found: 999/);
  } finally {
    await store.close();
  }
});

test("videos store a nullable recorded_at timestamp", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const created = await store.upsertVideo("clip.mp4", "2026-03-14T19:04:31.123Z");
    assert.deepEqual(created, { id: "clip.mp4", recordedAt: "2026-03-14T19:04:31.123Z" });
    assert.deepEqual(await store.findVideo("clip.mp4"), created);

    const duplicate = await store.upsertVideo("clip.mp4", "2020-01-01T00:00:00.000Z");
    assert.equal(duplicate.recordedAt, "2026-03-14T19:04:31.123Z");

    const updated = await store.setVideoRecordedAt("clip.mp4", "2026-03-14T19:04:31.123Z");
    assert.equal(updated.recordedAt, "2026-03-14T19:04:31.123Z");
    await assert.rejects(async () => store.setVideoRecordedAt("missing.mp4", "2026-03-14T19:04:31.123Z"), /Video not found/);
  } finally {
    await store.close();
  }
});

test("migration v2 adds recorded_at without dropping existing videos", async () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  database.exec(sqliteMigrations[0]!.sql);
  database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(1, "2026-01-01T00:00:00.000Z");
  database.prepare("INSERT INTO videos (id) VALUES (?)").run("clip.mp4");

  applySqliteMigrations(database);

  const versions = database
    .prepare("SELECT version FROM schema_migrations ORDER BY version")
    .all()
    .map((row) => Number((row as { version: number }).version));
  const row = database.prepare("SELECT id, recorded_at FROM videos WHERE id = ?").get("clip.mp4") as {
    id: string;
    recorded_at: string | null;
  };

  assert.deepEqual(versions, [1, 2, 3, 4]);
  assert.equal(row.id, "clip.mp4");
  assert.equal(row.recorded_at, null);
  database.close();
});

test("new tags use the default resource type", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const salsa = await store.upsertTag("salsa");
    const resource = (await store.findDefaultTagType())!;

    assert.equal(resource.name, "resource");
    assert.equal(salsa.typeName, "resource");
    assert.equal(salsa.color, "#93c5fd");
    assert.deepEqual(
      (await store.listTagTypes()).map((type) => type.name),
      ["type", "style", "teacher", "location", "resource"],
    );
  } finally {
    await store.close();
  }
});

test("migration v3 classifies existing tags and leaves unmatched tags as resource", async () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);
  database.exec(sqliteMigrations[0]!.sql);
  database.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(1, "2026-01-01T00:00:00.000Z");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("salsa");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("on2");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("jota");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("host");
  database.prepare("INSERT INTO tags (name) VALUES (?)").run("bufanda");

  applySqliteMigrations(database);

  const classified = database
    .prepare(
      `
        SELECT tags.name AS name, tag_types.name AS typeName
        FROM tags
        INNER JOIN tag_types ON tag_types.id = tags.tag_type_id
        ORDER BY tags.name
      `,
    )
    .all()
    .map((row) => {
      const typed = row as { name: string; typeName: string };
      return { name: typed.name, typeName: typed.typeName };
    });

  assert.deepEqual(classified, [
    { name: "bufanda", typeName: "resource" },
    { name: "host", typeName: "location" },
    { name: "jota", typeName: "teacher" },
    { name: "on2", typeName: "style" },
    { name: "salsa", typeName: "type" },
  ]);
  database.close();
});

test("tag types can be created, renamed, and deleted when unused", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const created = await store.createTagType("workshop", "#112233");
    assert.equal(created.name, "workshop");
    assert.equal(created.color, "#112233");
    assert.equal(created.isDefault, false);
    assert.equal(created.sortOrder, 6);
    assert.equal(created.tagCount, 0);

    const updated = await store.updateTagType(created.id, "workshops", "#abcdef");
    assert.equal(updated.name, "workshops");
    assert.equal(updated.color, "#abcdef");

    await store.deleteTagType(created.id);
    assert.equal(await store.findTagTypeById(created.id), null);
  } finally {
    await store.close();
  }
});

test("default and in-use tag types cannot be deleted", async () => {
  const store = openSqliteLibraryStore(":memory:");

  try {
    const resource = (await store.findDefaultTagType())!;
    const teacher = (await store.listTagTypes()).find((type) => type.name === "teacher")!;
    await store.upsertTag("jota");
    await store.updateTag((await store.findTagByName("jota"))!.id, "jota", teacher.id);

    await assert.rejects(async () => store.deleteTagType(resource.id), /Default tag type cannot be deleted/);
    await assert.rejects(async () => store.deleteTagType(teacher.id), /Tag type is in use: teacher/);
    await assert.rejects(async () => store.deleteTagType(999), /Tag type not found: 999/);
  } finally {
    await store.close();
  }
});

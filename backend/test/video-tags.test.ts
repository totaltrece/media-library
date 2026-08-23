import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { WorkspaceVideoDiscovery } from "../src/adapters/indexer/workspace-video-discovery.js";
import { SqliteLibraryIndexer } from "../src/adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { RefreshLibraryUseCase } from "../src/application/refresh-library.js";
import { SyncNewVideosUseCase } from "../src/application/sync-new-videos.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import type { LibraryStore } from "../src/ports/library-store.js";

import { testLibraryPath } from "./fixtures.js";
import { tagsWithDefaultColor } from "./tag-colors.js";

async function createAppWithStore(libraryStore: LibraryStore, libraryPath = testLibraryPath) {
  const videoIndex = new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));

  return createApp({
    videoIndex,
    libraryPath,
    libraryStore,
  });
}

test("GET /api/videos/:id/tags returns the video tags in stored order", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota", "codo"]);

    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "GET",
      url: "/api/videos/salsa/first.mp4/tags",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      tags: ["salsa", "isa", "jota", "codo"],
    });

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("POST /api/videos/:id/tags appends an existing catalog tag", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota"]);
    libraryStore.upsertTag("bufanda");

    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "POST",
      url: "/api/videos/salsa/first.mp4/tags",
      payload: { name: "bufanda" },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      tags: ["salsa", "isa", "jota", "bufanda"],
    });

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("POST /api/videos/:id/tags creates a new catalog tag automatically", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa"]);

    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "POST",
      url: "/api/videos/salsa/first.mp4/tags",
      payload: { name: "bufanda" },
    });
    const catalogResponse = await app.inject({
      method: "GET",
      url: "/api/tags",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.ok(libraryStore.findTagByName("bufanda"));
    assert.deepEqual(catalogResponse.json().tags, tagsWithDefaultColor(["bufanda", "salsa"]));

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("POST /api/videos/:id/tags is idempotent and preserves order", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota"]);

    const app = await createAppWithStore(libraryStore);
    await app.inject({
      method: "POST",
      url: "/api/videos/salsa/first.mp4/tags",
      payload: { name: "bufanda" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/videos/salsa/first.mp4/tags",
      payload: { name: "bufanda" },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      tags: ["salsa", "isa", "jota", "bufanda"],
    });

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("DELETE /api/videos/:id/tags/:tag removes a tag without deleting the catalog entry", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "isa", "jota", "bufanda"]);

    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "DELETE",
      url: "/api/videos/salsa/first.mp4/tags/isa",
    });
    const missingResponse = await app.inject({
      method: "DELETE",
      url: "/api/videos/salsa/first.mp4/tags/isa",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      tags: ["salsa", "jota", "bufanda"],
    });
    assert.deepEqual(missingResponse.json(), {
      tags: ["salsa", "jota", "bufanda"],
    });
    assert.ok(libraryStore.findTagByName("isa"));

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("DELETE /api/videos/:id/tags/:tag decodes reserved characters in the tag name", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "foo/bar"]);

    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "DELETE",
      url: `/api/videos/salsa/first.mp4/tags/${encodeURIComponent("foo/bar")}`,
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      tags: ["salsa"],
    });

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("PUT /api/videos/:id/tags replaces the complete tag list", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "isa"]);

    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "PUT",
      url: "/api/videos/salsa/first.mp4/tags",
      payload: { tags: ["salsa", "isa", "jota", "bufanda", "salsa"] },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      tags: ["salsa", "isa", "jota", "bufanda"],
    });
    assert.ok(libraryStore.findTagByName("jota"));
    assert.ok(libraryStore.findTagByName("bufanda"));

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("video tag edits are visible immediately in search", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa"]);

    const app = await createAppWithStore(libraryStore);
    await app.inject({
      method: "POST",
      url: "/api/videos/salsa/first.mp4/tags",
      payload: { name: "bufanda" },
    });
    const response = await app.inject({
      method: "GET",
      url: "/api/search?tag=bufanda",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().count, 1);
    assert.deepEqual(response.json().results[0]?.tags, ["salsa", "bufanda"]);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("editing a missing video returns 404 and does not create it", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "POST",
      url: "/api/videos/missing.mp4/tags",
      payload: { name: "salsa" },
    });

    assert.strictEqual(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: {
        message: "Video not found",
      },
    });
    assert.equal(libraryStore.findVideo("missing.mp4"), null);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("refresh does not restore TagSpaces tags after a SQLite edit", async () => {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-video-tags-"));
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await mkdir(join(libraryPath, ".ts"));
    await writeFile(join(libraryPath, "first.mp4"), "video");
    await writeFile(
      join(libraryPath, ".ts", "first.mp4.json"),
      JSON.stringify({ tags: [{ title: "tagspaces-only" }] }),
    );
    libraryStore.upsertVideo("first.mp4");
    libraryStore.setVideoTags("first.mp4", ["sqlite-tag"]);

    const videoIndex = new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));
    const app = await createApp({
      videoIndex,
      libraryPath,
      libraryStore,
      refreshLibraryUseCase: new RefreshLibraryUseCase(
        new SyncNewVideosUseCase(new WorkspaceVideoDiscovery(libraryPath), libraryStore, libraryPath),
        new SqliteLibraryIndexer(libraryStore, libraryPath),
        videoIndex,
      ),
    });

    await app.inject({
      method: "PUT",
      url: "/api/videos/first.mp4/tags",
      payload: { tags: ["edited-tag"] },
    });

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });
    const tagsResponse = await app.inject({
      method: "GET",
      url: "/api/videos/first.mp4/tags",
    });
    const searchResponse = await app.inject({
      method: "GET",
      url: "/api/search?tag=edited-tag",
    });

    assert.strictEqual(refreshResponse.statusCode, 200);
    assert.deepEqual(tagsResponse.json(), { tags: ["edited-tag"] });
    assert.strictEqual(searchResponse.json().count, 1);
    assert.equal(libraryStore.findTagByName("tagspaces-only"), null);

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

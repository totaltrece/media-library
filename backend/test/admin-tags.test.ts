import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import type { LibraryStore } from "../src/ports/library-store.js";

import { testLibraryPath } from "./fixtures.js";

async function createAppWithStore(libraryStore: LibraryStore, libraryPath = testLibraryPath) {
  const videoIndex = new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));

  return createApp({
    videoIndex,
    libraryPath,
    libraryStore,
  });
}

test("GET /api/admin/tags lists catalog tags with usage counts", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.upsertVideo("salsa/second.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    libraryStore.setVideoTags("salsa/second.mp4", ["salsa"]);
    libraryStore.upsertTag("bufanda");

    const salsa = libraryStore.findTagByName("salsa")!;
    const jota = libraryStore.findTagByName("jota")!;
    const bufanda = libraryStore.findTagByName("bufanda")!;
    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/tags",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      count: 3,
      tags: [
        { ...bufanda, usageCount: 0 },
        { ...jota, usageCount: 1 },
        { ...salsa, usageCount: 2 },
      ],
    });

    const consumerTags = await app.inject({
      method: "GET",
      url: "/api/tags",
    });

    assert.strictEqual(consumerTags.statusCode, 200);
    assert.deepEqual(consumerTags.json(), {
      count: 2,
      tags: [
        { name: "jota", color: jota.color },
        { name: "salsa", color: salsa.color },
      ],
    });

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("PUT /api/admin/tags/:id renames a tag without changing its id or video relations", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    const jota = libraryStore.findTagByName("jota")!;
    const app = await createAppWithStore(libraryStore);

    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/tags/${jota.id}`,
      payload: { name: "jota-nueva" },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      ...libraryStore.findTagByName("jota-nueva")!,
      usageCount: 1,
    });
    assert.equal(libraryStore.findTagByName("jota"), null);
    assert.strictEqual(libraryStore.findTagById(jota.id)?.name, "jota-nueva");
    assert.deepEqual(libraryStore.getVideoTags("salsa/first.mp4"), ["jota-nueva", "salsa"]);

    const search = await app.inject({
      method: "GET",
      url: "/api/search?tag=jota-nueva",
    });

    assert.strictEqual(search.statusCode, 200);
    assert.strictEqual(search.json().count, 1);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("PUT /api/admin/tags/:id rejects empty names and existing names", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const salsa = libraryStore.upsertTag("salsa");
    libraryStore.upsertTag("jota");
    const app = await createAppWithStore(libraryStore);

    const empty = await app.inject({
      method: "PUT",
      url: `/api/admin/tags/${salsa.id}`,
      payload: { name: "   " },
    });
    const conflict = await app.inject({
      method: "PUT",
      url: `/api/admin/tags/${salsa.id}`,
      payload: { name: "jota" },
    });
    const missing = await app.inject({
      method: "PUT",
      url: "/api/admin/tags/999",
      payload: { name: "nuevo" },
    });

    assert.strictEqual(empty.statusCode, 400);
    assert.strictEqual(conflict.statusCode, 409);
    assert.strictEqual(missing.statusCode, 404);
    assert.deepEqual(libraryStore.listTags().map((tag) => tag.name), ["jota", "salsa"]);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("DELETE /api/admin/tags/:id removes the tag and its video relations", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.upsertVideo("salsa/second.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    libraryStore.setVideoTags("salsa/second.mp4", ["salsa"]);
    const jota = libraryStore.findTagByName("jota")!;
    const salsa = libraryStore.findTagByName("salsa")!;
    const app = await createAppWithStore(libraryStore);

    const response = await app.inject({
      method: "DELETE",
      url: `/api/admin/tags/${jota.id}`,
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), { id: jota.id });
    assert.equal(libraryStore.findTagById(jota.id), null);
    assert.deepEqual(libraryStore.getVideoTags("salsa/first.mp4"), ["salsa"]);
    assert.deepEqual(libraryStore.listVideos().map((video) => video.id), [
      "salsa/first.mp4",
      "salsa/second.mp4",
    ]);
    assert.deepEqual(libraryStore.findTagById(salsa.id), salsa);

    const missing = await app.inject({
      method: "DELETE",
      url: "/api/admin/tags/999",
    });

    assert.strictEqual(missing.statusCode, 404);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("PUT /api/admin/tags/:id updates the tag type", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const jota = libraryStore.upsertTag("jota");
    const teacher = libraryStore.listTagTypes().find((type) => type.name === "teacher")!;
    const app = await createAppWithStore(libraryStore);

    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/tags/${jota.id}`,
      payload: { name: "jota", typeId: teacher.id },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      ...libraryStore.findTagByName("jota")!,
      usageCount: 0,
    });
    assert.strictEqual(libraryStore.findTagById(jota.id)?.typeName, "teacher");

    await app.close();
  } finally {
    libraryStore.close();
  }
});

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

test("GET /api/admin/tag-types lists the seeded types", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "GET",
      url: "/api/admin/tag-types",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      count: 5,
      types: libraryStore.listTagTypes(),
    });
    assert.deepEqual(
      response.json().types.map((type: { name: string }) => type.name),
      ["type", "style", "teacher", "location", "resource"],
    );

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("POST /api/admin/tag-types creates a type at the end of the sort order", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "POST",
      url: "/api/admin/tag-types",
      payload: { name: "workshop", color: "#112233" },
    });

    assert.strictEqual(response.statusCode, 201);
    assert.equal(response.json().name, "workshop");
    assert.equal(response.json().color, "#112233");
    assert.equal(response.json().isDefault, false);
    assert.equal(response.json().sortOrder, 6);

    const conflict = await app.inject({
      method: "POST",
      url: "/api/admin/tag-types",
      payload: { name: "workshop", color: "#abcdef" },
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/api/admin/tag-types",
      payload: { name: "bad", color: "red" },
    });

    assert.strictEqual(conflict.statusCode, 409);
    assert.strictEqual(invalid.statusCode, 400);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("PUT /api/admin/tag-types/:id renames and recolors a type", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const teacher = libraryStore.listTagTypes().find((type) => type.name === "teacher")!;
    const app = await createAppWithStore(libraryStore);
    const response = await app.inject({
      method: "PUT",
      url: `/api/admin/tag-types/${teacher.id}`,
      payload: { name: "profesor", color: "#00ff00" },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.equal(response.json().name, "profesor");
    assert.equal(response.json().color, "#00ff00");
    assert.equal(response.json().isDefault, false);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("DELETE /api/admin/tag-types/:id blocks the default type and types in use", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const resource = libraryStore.findDefaultTagType()!;
    const created = libraryStore.createTagType("workshop", "#112233");
    libraryStore.upsertTag("jota");
    const teacher = libraryStore.listTagTypes().find((type) => type.name === "teacher")!;
    libraryStore.updateTag(libraryStore.findTagByName("jota")!.id, "jota", teacher.id);
    const app = await createAppWithStore(libraryStore);

    const defaultType = await app.inject({
      method: "DELETE",
      url: `/api/admin/tag-types/${resource.id}`,
    });
    const inUse = await app.inject({
      method: "DELETE",
      url: `/api/admin/tag-types/${teacher.id}`,
    });
    const unused = await app.inject({
      method: "DELETE",
      url: `/api/admin/tag-types/${created.id}`,
    });
    const missing = await app.inject({
      method: "DELETE",
      url: "/api/admin/tag-types/999",
    });

    assert.strictEqual(defaultType.statusCode, 409);
    assert.strictEqual(inUse.statusCode, 409);
    assert.strictEqual(unused.statusCode, 200);
    assert.deepEqual(unused.json(), { id: created.id });
    assert.strictEqual(missing.statusCode, 404);
    assert.equal(libraryStore.findTagTypeById(created.id), null);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

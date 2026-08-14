import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { SqliteLibraryIndexer } from "../src/adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { createApp } from "../src/app.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

test("POST /api/library/refresh returns the video count loaded from SQLite", async () => {
  const sqlitePath = join(await mkdtemp(join(tmpdir(), "media-library-refresh-")), "library.sqlite");
  const libraryStore = openSqliteLibraryStore(sqlitePath);

  try {
    libraryStore.upsertVideo("new-video.mp4");
    libraryStore.setVideoTags("new-video.mp4", ["new-tag"]);

    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath: testLibraryPath,
      libraryIndexer: new SqliteLibraryIndexer(libraryStore, testLibraryPath),
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), { count: 1 });

    await app.close();
  } finally {
    libraryStore.close();
    await rm(join(sqlitePath, ".."), { recursive: true, force: true });
  }
});

test("POST /api/library/refresh updates tags and search results from SQLite", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("new-video.mp4");
    libraryStore.setVideoTags("new-video.mp4", ["new-tag"]);

    const videoIndex = new InMemoryVideoIndex(testVideos);
    const app = await createApp({
      videoIndex,
      libraryPath: testLibraryPath,
      libraryIndexer: new SqliteLibraryIndexer(libraryStore, testLibraryPath),
    });

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });

    assert.strictEqual(refreshResponse.statusCode, 200);

    const tagsResponse = await app.inject({
      method: "GET",
      url: "/api/tags",
    });

    assert.deepEqual(tagsResponse.json(), {
      count: 1,
      tags: ["new-tag"],
    });

    const searchResponse = await app.inject({
      method: "GET",
      url: "/api/search?tag=new-tag",
    });

    assert.strictEqual(searchResponse.json().count, 1);
    assert.deepEqual(searchResponse.json().results[0]?.tags, ["new-tag"]);

    await app.close();
  } finally {
    libraryStore.close();
  }
});

test("POST /api/library/refresh returns 500 and preserves the existing index on failure", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");
  libraryStore.upsertVideo("new-video.mp4");
  libraryStore.close();

  const videoIndex = new InMemoryVideoIndex(testVideos);
  const app = await createApp({
    videoIndex,
    libraryPath: testLibraryPath,
    libraryIndexer: new SqliteLibraryIndexer(libraryStore, testLibraryPath),
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/library/refresh",
  });

  assert.strictEqual(response.statusCode, 500);
  assert.match(response.json().error.message, /./);

  const tagsResponse = await app.inject({
    method: "GET",
    url: "/api/tags",
  });

  assert.deepEqual(tagsResponse.json(), {
    count: 5,
    tags: ["bachata", "bea", "damian", "linea", "salsa"],
  });

  await app.close();
});

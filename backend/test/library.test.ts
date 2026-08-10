import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

async function createTemporaryLibrary(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-refresh-"));

  await mkdir(join(libraryPath, ".ts"), { recursive: true });
  await writeFile(join(libraryPath, "new-video.mp4"), "video");
  await writeFile(
    join(libraryPath, ".ts", "new-video.mp4.json"),
    JSON.stringify({
      tags: [{ title: "new-tag" }],
    }),
  );

  return libraryPath;
}

test("POST /api/library/refresh returns the indexed video count", async () => {
  const libraryPath = await createTemporaryLibrary();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex([]),
    libraryPath,
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), { count: 1 });
  } finally {
    await app.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("POST /api/library/refresh updates tags and search results", async () => {
  const libraryPath = await createTemporaryLibrary();
  const videoIndex = new InMemoryVideoIndex(testVideos);
  const app = await createApp({
    videoIndex,
    libraryPath,
  });

  try {
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
  } finally {
    await app.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("POST /api/library/refresh returns 500 and preserves the existing index on failure", async () => {
  const videoIndex = new InMemoryVideoIndex(testVideos);
  const app = await createApp({
    videoIndex,
    libraryPath: join(tmpdir(), "media-library-refresh-missing"),
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

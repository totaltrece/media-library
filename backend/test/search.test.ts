import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

async function createTestApp() {
  return createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
  });
}

test("GET /search returns videos matching every requested tag", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/search?tags=salsa,bea",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    count: 1,
    results: [
      {
        path: "first.mp4",
        thumbnail: "/thumbnails/first.mp4.jpg",
        tags: ["salsa", "bea", "linea"],
      },
    ],
  });

  await app.close();
});

test("GET /search without tags returns all indexed videos", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/search",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    count: 3,
    results: [
      {
        path: "first.mp4",
        thumbnail: "/thumbnails/first.mp4.jpg",
        tags: ["salsa", "bea", "linea"],
      },
      {
        path: "second.mp4",
        thumbnail: "/thumbnails/second.mp4.jpg",
        tags: ["salsa", "damian"],
      },
      {
        path: "third.mp4",
        thumbnail: "/thumbnails/third.mp4.jpg",
        tags: ["bachata", "bea"],
      },
    ],
  });

  await app.close();
});

test("GET /search returns an empty result when no videos match", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/search?tags=unknown",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    count: 0,
    results: [],
  });

  await app.close();
});

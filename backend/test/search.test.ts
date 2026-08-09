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
    url: "/api/search?tag=salsa&tag=bea",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    query: {
      tags: ["salsa", "bea"],
    },
    count: 1,
    results: [
      {
        id: "salsa/first.mp4",
        name: "first.mp4",
        thumbnail: "/api/thumbnail/salsa/first.mp4",
        video: "/api/video/salsa/first.mp4",
        tags: ["salsa", "bea", "linea"],
      },
    ],
  });

  await app.close();
});

test("GET /search echoes requested tags exactly as received", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/search?tag=SALSA&tag=bea",
  });

  assert.strictEqual(response.statusCode, 200);

  const body = response.json();

  assert.deepEqual(body.query, {
    tags: ["SALSA", "bea"],
  });
  assert.strictEqual(body.count, 1);
  assert.strictEqual(body.results[0]?.id, "salsa/first.mp4");

  await app.close();
});

test("GET /search without tags returns all indexed videos", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/search",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    query: {
      tags: [],
    },
    count: 3,
    results: [
      {
        id: "salsa/first.mp4",
        name: "first.mp4",
        thumbnail: "/api/thumbnail/salsa/first.mp4",
        video: "/api/video/salsa/first.mp4",
        tags: ["salsa", "bea", "linea"],
      },
      {
        id: "salsa/second.mp4",
        name: "second.mp4",
        thumbnail: "/api/thumbnail/salsa/second.mp4",
        video: "/api/video/salsa/second.mp4",
        tags: ["salsa", "damian"],
      },
      {
        id: "bachata/third.mp4",
        name: "third.mp4",
        thumbnail: "/api/thumbnail/bachata/third.mp4",
        video: "/api/video/bachata/third.mp4",
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
    url: "/api/search?tag=unknown",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    query: {
      tags: ["unknown"],
    },
    count: 0,
    results: [],
  });

  await app.close();
});

test("GET /search never exposes filesystem paths in the response", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/search?tag=salsa",
  });

  assert.strictEqual(response.statusCode, 200);

  const serialized = JSON.stringify(response.json());

  assert.doesNotMatch(serialized, /C:\\\\media-library/i);
  assert.doesNotMatch(serialized, /videoPath/);
  assert.doesNotMatch(serialized, /metadataPath/);
  assert.doesNotMatch(serialized, /thumbnailPath/);

  await app.close();
});

test("GET /search builds thumbnail and video URLs from the media id", async () => {
  const app = await createTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/search?tag=bachata",
  });

  assert.strictEqual(response.statusCode, 200);

  const result = response.json().results[0];

  assert.strictEqual(result.id, "bachata/third.mp4");
  assert.strictEqual(result.thumbnail, "/api/thumbnail/bachata/third.mp4");
  assert.strictEqual(result.video, "/api/video/bachata/third.mp4");

  await app.close();
});

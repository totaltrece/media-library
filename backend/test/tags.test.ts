import assert from "node:assert/strict";
import { test } from "node:test";

import type { IndexedVideo } from "@media-library/indexer";

import { collectDistinctTags } from "../src/application/get-tags.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";
import type { VideoIndex } from "../src/ports/video-index.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

class TrackingVideoIndex implements VideoIndex {
  getVideosCalls = 0;

  constructor(private readonly videos: IndexedVideo[]) {}

  getVideos(): IndexedVideo[] {
    this.getVideosCalls += 1;

    return this.videos;
  }
}

test("collectDistinctTags returns unique tags in alphabetical order", () => {
  assert.deepEqual(collectDistinctTags(testVideos), [
    "bachata",
    "bea",
    "damian",
    "linea",
    "salsa",
  ]);
});

test("GET /tags returns distinct tags from the in-memory index", async () => {
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
  });

  const response = await app.inject({
    method: "GET",
    url: "/tags",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    count: 5,
    tags: ["bachata", "bea", "damian", "linea", "salsa"],
  });
  assert.doesNotMatch(JSON.stringify(response.json()), /videoPath/);
  assert.doesNotMatch(JSON.stringify(response.json()), /media-library/);

  await app.close();
});

test("GET /tags returns an empty list when the index has no videos", async () => {
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex([]),
    libraryPath: testLibraryPath,
  });

  const response = await app.inject({
    method: "GET",
    url: "/tags",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    count: 0,
    tags: [],
  });

  await app.close();
});

test("GET /tags reads from the existing index without re-indexing", async () => {
  const trackingIndex = new TrackingVideoIndex(testVideos);
  const app = await createApp({
    videoIndex: trackingIndex,
    libraryPath: testLibraryPath,
  });

  const response = await app.inject({
    method: "GET",
    url: "/tags",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.strictEqual(trackingIndex.getVideosCalls, 1);

  await app.close();
});

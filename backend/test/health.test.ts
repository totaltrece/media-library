import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

test("GET /api/health returns ok status", async () => {
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/health",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), { status: "ok" });

  await app.close();
});

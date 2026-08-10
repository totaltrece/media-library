import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildSearchResponse,
  toMediaId,
  toSearchResult,
  toThumbnailUrl,
  toVideoUrl,
} from "../src/adapters/http/search-response.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

test("toMediaId returns a library-relative path with forward slashes", () => {
  assert.strictEqual(
    toMediaId(join(testLibraryPath, "bachata", "20250630_193642391.TS.mp4"), testLibraryPath),
    "bachata/20250630_193642391.TS.mp4",
  );
});

test("toSearchResult maps indexed videos to the public search item shape", () => {
  assert.deepEqual(toSearchResult(testVideos[0]!, testLibraryPath), {
    id: "salsa/first.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa/first.mp4",
    video: "/api/video/salsa/first.mp4",
    tags: ["salsa", "bea", "linea"],
  });
});

test("buildSearchResponse includes query, count, and mapped results", () => {
  assert.deepEqual(buildSearchResponse(["salsa", "bea"], [testVideos[0]!], testLibraryPath), {
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
});

test("media URLs are derived from the media id", () => {
  const mediaId = "bachata/20250630_193642391.TS.mp4";

  assert.strictEqual(toThumbnailUrl(mediaId), "/api/thumbnail/bachata/20250630_193642391.TS.mp4");
  assert.strictEqual(toVideoUrl(mediaId), "/api/video/bachata/20250630_193642391.TS.mp4");
});

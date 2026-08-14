import assert from "node:assert/strict";
import { resolve } from "node:path";
import { test } from "node:test";

import { toIndexedVideo, toIndexedVideos } from "../src/application/to-indexed-videos.js";

import { testLibraryPath } from "./fixtures.js";

test("toIndexedVideo derives videoPath from the media id and uses SQLite tags", () => {
  assert.deepEqual(toIndexedVideo({ id: "salsa/first.mp4", tags: ["salsa", "bea"] }, testLibraryPath), {
    videoPath: resolve(testLibraryPath, "salsa", "first.mp4"),
    tags: ["salsa", "bea"],
  });
});

test("toIndexedVideo does not invent TagSpaces sidecar paths", () => {
  const indexedVideo = toIndexedVideo({ id: "salsa/first.mp4", tags: ["salsa"] }, testLibraryPath);

  assert.strictEqual("metadataPath" in indexedVideo, false);
  assert.strictEqual("thumbnailPath" in indexedVideo, false);
});

test("toIndexedVideo rejects invalid media ids", () => {
  assert.throws(() => toIndexedVideo({ id: "../secret.mp4", tags: [] }, testLibraryPath), {
    message: "Invalid media id in library store: ../secret.mp4",
  });
});

test("toIndexedVideos preserves indexer path order", () => {
  const indexedVideos = toIndexedVideos(
    [
      { id: "salsa/second.mp4", tags: ["salsa"] },
      { id: "bachata/third.mp4", tags: ["bachata"] },
      { id: "salsa/first.mp4", tags: ["salsa", "bea"] },
    ],
    testLibraryPath,
  );

  assert.deepEqual(
    indexedVideos.map((video) => video.videoPath),
    [
      resolve(testLibraryPath, "bachata", "third.mp4"),
      resolve(testLibraryPath, "salsa", "first.mp4"),
      resolve(testLibraryPath, "salsa", "second.mp4"),
    ],
  );
});

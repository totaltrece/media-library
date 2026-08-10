import assert from "node:assert/strict";
import { test } from "node:test";

import type { IndexedVideo } from "@media-library/indexer";

import { searchVideos } from "../src/index.js";

const videos: IndexedVideo[] = [
  {
    videoPath: "/library/first.mp4",
    tags: ["salsa", "linea"],
  },
  {
    videoPath: "/library/second.mp4",
    tags: ["salsa"],
  },
  {
    videoPath: "/library/third.mp4",
    tags: ["linea", "salsa", "jota"],
  },
  {
    videoPath: "/library/fourth.mp4",
    tags: ["bachata"],
  },
];

test("returns all videos when query tags are undefined", () => {
  assert.strictEqual(searchVideos(videos, {}), videos);
});

test("returns all videos when query tags are empty", () => {
  assert.strictEqual(searchVideos(videos, { tags: [] }), videos);
});

test("matches videos containing every requested tag", () => {
  assert.deepEqual(
    searchVideos(videos, { tags: ["salsa", "linea"] }).map((video) => video.videoPath),
    ["/library/first.mp4", "/library/third.mp4"],
  );
});

test("matches tags without regard to case", () => {
  assert.deepEqual(
    searchVideos(videos, { tags: ["SALSA"] }).map((video) => video.videoPath),
    ["/library/first.mp4", "/library/second.mp4", "/library/third.mp4"],
  );
});

test("ignores duplicate query tags and preserves input order", () => {
  assert.deepEqual(
    searchVideos(videos, { tags: ["LINEA", "salsa", "linea"] }).map((video) => video.videoPath),
    ["/library/first.mp4", "/library/third.mp4"],
  );
});

test("returns no videos when any requested tag is absent", () => {
  assert.deepEqual(searchVideos(videos, { tags: ["salsa", "kizomba"] }), []);
});

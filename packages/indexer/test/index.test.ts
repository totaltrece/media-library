import assert from "node:assert/strict";
import { test } from "node:test";
import { resolve } from "node:path";

import { indexLibrary } from "../src/index.js";

const libraryPath = resolve(process.cwd(), "../../samples/indexer-library");

test("indexes videos recursively and finds TagSpaces sidecars", async () => {
  const indexedVideos = await indexLibrary(libraryPath);

  assert.deepEqual(indexedVideos, [
    {
      videoPath: resolve(libraryPath, "PXL_20260702_201741381.TS.mp4"),
      metadataPath: resolve(libraryPath, ".ts/PXL_20260702_201741381.TS.mp4.json"),
      thumbnailPath: resolve(libraryPath, ".ts/PXL_20260702_201741381.TS.mp4.jpg"),
    },
    {
      videoPath: resolve(libraryPath, "PXL_20260703_190605043.TS.mp4"),
      metadataPath: resolve(libraryPath, ".ts/PXL_20260703_190605043.TS.mp4.json"),
      thumbnailPath: resolve(libraryPath, ".ts/PXL_20260703_190605043.TS.mp4.jpg"),
    },
    {
      videoPath: resolve(libraryPath, "PXL_20260703_202126509.TS.mp4"),
      metadataPath: resolve(libraryPath, ".ts/PXL_20260703_202126509.TS.mp4.json"),
      thumbnailPath: resolve(libraryPath, ".ts/PXL_20260703_202126509.TS.mp4.jpg"),
    },
  ]);
});

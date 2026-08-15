import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  resolveLibraryThumbnailPath,
  resolveLibraryVideoPath,
} from "../src/application/library-media-paths.js";

test("library media paths resolve video and TagSpaces thumbnail locations", async () => {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-paths-"));

  try {
    assert.equal(resolveLibraryVideoPath(libraryPath, "PXL_clip.mp4"), join(libraryPath, "PXL_clip.mp4"));
    assert.equal(
      resolveLibraryThumbnailPath(libraryPath, "PXL_clip.mp4"),
      join(libraryPath, ".ts", "PXL_clip.mp4.jpg"),
    );
    assert.equal(resolveLibraryVideoPath(libraryPath, "../escape.mp4"), undefined);
    assert.equal(resolveLibraryThumbnailPath(libraryPath, "..\\escape.mp4"), undefined);
  } finally {
    await rm(libraryPath, { recursive: true, force: true });
  }
});

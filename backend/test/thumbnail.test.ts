import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { TagSpacesThumbnailStore } from "../src/adapters/filesystem/tagspaces-thumbnail-store.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

const thumbnailBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);

async function createLibraryWithThumbnail(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-thumbnail-"));

  await mkdir(join(libraryPath, "salsa"));
  await mkdir(join(libraryPath, ".ts"));
  await writeFile(join(libraryPath, "salsa", "first.mp4"), "video");
  await writeFile(join(libraryPath, ".ts", "first.mp4.jpg"), thumbnailBytes);

  return libraryPath;
}

async function createLibraryWithoutThumbnail(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-thumbnail-"));

  await mkdir(join(libraryPath, "salsa"));
  await mkdir(join(libraryPath, ".ts"));
  await writeFile(join(libraryPath, "salsa", "first.mp4"), "video");

  return libraryPath;
}

test("GET /thumbnail/:id returns the TagSpaces thumbnail with image/jpeg", async () => {
  const libraryPath = await createLibraryWithThumbnail();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/thumbnail/salsa/first.mp4",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers["content-type"], "image/jpeg");
    assert.deepEqual(response.rawPayload, thumbnailBytes);

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("GET /thumbnail/:id returns 404 when the video does not exist", async () => {
  const libraryPath = await createLibraryWithThumbnail();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/thumbnail/salsa/missing.mp4",
    });

    assert.strictEqual(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: {
        message: "Thumbnail not found",
      },
    });
    assert.doesNotMatch(JSON.stringify(response.json()), /media-library-thumbnail-/);

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("GET /thumbnail/:id returns 404 when the TagSpaces thumbnail is missing", async () => {
  const libraryPath = await createLibraryWithoutThumbnail();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/thumbnail/salsa/first.mp4",
    });

    assert.strictEqual(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: {
        message: "Thumbnail not found",
      },
    });

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("TagSpacesThumbnailStore rejects path traversal media ids", async () => {
  const libraryPath = await createLibraryWithThumbnail();

  try {
    const store = new TagSpacesThumbnailStore(libraryPath);

    assert.strictEqual(await store.getThumbnail("../first.mp4"), null);
    assert.strictEqual(await store.getThumbnail("salsa/../../first.mp4"), null);
    assert.strictEqual(await store.getThumbnail("/salsa/first.mp4"), null);
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

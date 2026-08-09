import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FilesystemVideoStore } from "../src/adapters/filesystem/filesystem-video-store.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

const videoBytes = Buffer.from("0123456789");

async function createLibraryWithVideo(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-video-"));

  await mkdir(join(libraryPath, "salsa"));
  await writeFile(join(libraryPath, "salsa", "first.mp4"), videoBytes);

  return libraryPath;
}

test("GET /video/:id returns the full video with the correct Content-Type", async () => {
  const libraryPath = await createLibraryWithVideo();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const response = await app.inject({
      method: "GET",
      url: "/video/salsa/first.mp4",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.headers["content-type"], "video/mp4");
    assert.strictEqual(response.headers["accept-ranges"], "bytes");
    assert.strictEqual(response.headers["content-length"], "10");
    assert.deepEqual(response.rawPayload, videoBytes);

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("GET /video/:id returns 206 Partial Content for valid Range requests", async () => {
  const libraryPath = await createLibraryWithVideo();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const response = await app.inject({
      method: "GET",
      url: "/video/salsa/first.mp4",
      headers: {
        range: "bytes=0-4",
      },
    });

    assert.strictEqual(response.statusCode, 206);
    assert.strictEqual(response.headers["content-type"], "video/mp4");
    assert.strictEqual(response.headers["accept-ranges"], "bytes");
    assert.strictEqual(response.headers["content-range"], "bytes 0-4/10");
    assert.strictEqual(response.headers["content-length"], "5");
    assert.deepEqual(response.rawPayload, Buffer.from("01234"));

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("GET /video/:id returns 404 when the video does not exist", async () => {
  const libraryPath = await createLibraryWithVideo();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const response = await app.inject({
      method: "GET",
      url: "/video/salsa/missing.mp4",
    });

    assert.strictEqual(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: {
        message: "Video not found",
      },
    });
    assert.doesNotMatch(JSON.stringify(response.json()), /media-library-video-/);

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("GET /video/:id returns 416 for invalid or unsatisfiable Range requests", async () => {
  const libraryPath = await createLibraryWithVideo();

  try {
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
    });

    const invalidRange = await app.inject({
      method: "GET",
      url: "/video/salsa/first.mp4",
      headers: {
        range: "invalid",
      },
    });

    assert.strictEqual(invalidRange.statusCode, 416);
    assert.strictEqual(invalidRange.headers["content-range"], "bytes */10");
    assert.deepEqual(invalidRange.json(), {
      error: {
        message: "Range not satisfiable",
      },
    });

    const unsatisfiableRange = await app.inject({
      method: "GET",
      url: "/video/salsa/first.mp4",
      headers: {
        range: "bytes=20-30",
      },
    });

    assert.strictEqual(unsatisfiableRange.statusCode, 416);
    assert.strictEqual(unsatisfiableRange.headers["content-range"], "bytes */10");

    await app.close();
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

test("FilesystemVideoStore rejects path traversal media ids", async () => {
  const libraryPath = await createLibraryWithVideo();

  try {
    const store = new FilesystemVideoStore(libraryPath);

    assert.strictEqual(await store.getVideo("../first.mp4"), null);
    assert.strictEqual(await store.getVideo("salsa/../../first.mp4"), null);
    assert.strictEqual(await store.getVideo("/salsa/first.mp4"), null);
  } finally {
    await rm(libraryPath, { force: true, recursive: true });
  }
});

import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

async function createStaticFixture(): Promise<string> {
  const staticRoot = await mkdtemp(join(tmpdir(), "media-library-static-"));

  await mkdir(join(staticRoot, "assets"), { recursive: true });
  await writeFile(join(staticRoot, "index.html"), "<!doctype html><title>Media Library</title>");
  await writeFile(join(staticRoot, "assets", "app.js"), "console.log('app');");

  return staticRoot;
}

test("GET / serves the built frontend index.html", async () => {
  const staticRoot = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  const response = await app.inject({
    method: "GET",
    url: "/",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.match(response.body, /Media Library/);

  await app.close();
});

test("GET /assets/* serves static frontend assets", async () => {
  const staticRoot = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  const response = await app.inject({
    method: "GET",
    url: "/assets/app.js",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.match(response.body, /console\.log\('app'\)/);

  await app.close();
});

test("unknown non-API routes return 404", async () => {
  const staticRoot = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  for (const url of ["/foo", "/anything", "/foo/bar"]) {
    const response = await app.inject({
      method: "GET",
      url,
    });

    assert.strictEqual(response.statusCode, 404, `expected 404 for ${url}`);
  }

  await app.close();
});

test("API routes remain available when static frontend is enabled", async () => {
  const staticRoot = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/tags",
  });

  assert.strictEqual(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    count: 5,
    tags: ["bachata", "bea", "damian", "linea", "salsa"],
  });

  await app.close();
});

test("unknown API routes return JSON 404 responses", async () => {
  const staticRoot = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/unknown",
  });

  assert.strictEqual(response.statusCode, 404);
  assert.deepEqual(response.json(), {
    error: {
      message: "Not found",
    },
  });

  await app.close();
});

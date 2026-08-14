import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { createApp } from "../src/app.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

async function createStaticFixture(): Promise<{
  cssPath: string;
  jsPath: string;
  staticRoot: string;
}> {
  const staticRoot = await mkdtemp(join(tmpdir(), "media-library-static-"));

  await mkdir(join(staticRoot, "assets"), { recursive: true });
  await writeFile(
    join(staticRoot, "index.html"),
    '<!doctype html><title>Media Library</title><script src="/assets/index-abc123.js"></script>',
  );
  await writeFile(join(staticRoot, "assets", "index-abc123.js"), "console.log('app');");
  await writeFile(join(staticRoot, "assets", "index-abc123.css"), "body { color: red; }");

  return {
    cssPath: "/assets/index-abc123.css",
    jsPath: "/assets/index-abc123.js",
    staticRoot,
  };
}

test("GET / serves the built frontend index.html", async () => {
  const { staticRoot } = await createStaticFixture();
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

test("GET /assets/* serves hashed frontend assets", async () => {
  const { cssPath, jsPath, staticRoot } = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  const jsResponse = await app.inject({
    method: "GET",
    url: jsPath,
  });

  assert.strictEqual(jsResponse.statusCode, 200);
  assert.match(jsResponse.body, /console\.log\('app'\)/);

  const cssResponse = await app.inject({
    method: "GET",
    url: cssPath,
  });

  assert.strictEqual(cssResponse.statusCode, 200);
  assert.match(cssResponse.body, /color: red/);

  await app.close();
});

test("GET /assets/* serves assets from the built frontend dist", async (t) => {
  const staticRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../frontend/dist");

  if (!existsSync(staticRoot)) {
    t.skip("frontend dist is not built");
    return;
  }

  const indexHtml = await readFile(join(staticRoot, "index.html"), "utf8");
  const jsMatch = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/);

  assert.notEqual(jsMatch, null);

  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  const response = await app.inject({
    method: "GET",
    url: jsMatch![1]!,
  });

  assert.strictEqual(response.statusCode, 200);

  await app.close();
});

test("unknown non-API routes return 404", async () => {
  const { staticRoot } = await createStaticFixture();
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

test("GET /admin and /admin/* serve the frontend index.html", async () => {
  const { staticRoot } = await createStaticFixture();
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(testVideos),
    libraryPath: testLibraryPath,
    staticRoot,
  });

  for (const url of ["/admin", "/admin/videos", "/admin/videos/salsa/first.mp4"]) {
    const response = await app.inject({
      method: "GET",
      url,
    });

    assert.strictEqual(response.statusCode, 200, `expected 200 for ${url}`);
    assert.match(response.body, /Media Library/);
  }

  await app.close();
});

test("API routes remain available when static frontend is enabled", async () => {
  const { staticRoot } = await createStaticFixture();
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
  const { staticRoot } = await createStaticFixture();
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

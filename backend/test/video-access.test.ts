import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { SESSION_COOKIE_NAME } from "../src/adapters/http/session-cookie.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { openSqliteStores } from "../src/adapters/sqlite/sqlite-library-store.js";
import { contentDispositionAttachment } from "../src/application/content-disposition.js";
import { hashPassword } from "../src/application/password-hash.js";
import { createApp } from "../src/app.js";

const videoBytes = Buffer.from("0123456789");
const CAST_SECRET = "test-cast-secret";

async function createLibrary(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-cast-"));

  await mkdir(join(libraryPath, "salsa"));
  await writeFile(join(libraryPath, "salsa", "first.mp4"), videoBytes);
  await writeFile(join(libraryPath, "salsa", "my clip.mp4"), videoBytes);
  await writeFile(join(libraryPath, "salsa", "second.mp4"), videoBytes);

  return libraryPath;
}

function cookieHeader(token: string): Record<string, string> {
  return { cookie: `${SESSION_COOKIE_NAME}=${token}` };
}

test("a view session can cast and download, and the cast token streams without a cookie", async () => {
  const libraryPath = await createLibrary();
  const stores = openSqliteStores(":memory:");

  try {
    await stores.authStore.createUser("viewer", hashPassword("password1"), "view");
    const app = await createApp({
      videoIndex: new InMemoryVideoIndex([]),
      libraryPath,
      authStore: stores.authStore,
      authPublicRead: false,
      castUrlSecret: CAST_SECRET,
    });

    const anonymousVideo = await app.inject({
      method: "GET",
      url: "/api/video/salsa/first.mp4",
    });
    assert.equal(anonymousVideo.statusCode, 401);

    const anonymousCast = await app.inject({
      method: "POST",
      url: "/api/cast/links",
      payload: { id: "salsa/first.mp4" },
    });
    assert.equal(anonymousCast.statusCode, 401);

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "viewer", password: "password1" },
    });
    const session = login.cookies.find((cookie) => cookie.name === SESSION_COOKIE_NAME);
    assert.ok(session);

    const missing = await app.inject({
      method: "POST",
      url: "/api/cast/links",
      headers: cookieHeader(session.value),
      payload: {},
    });
    assert.equal(missing.statusCode, 400);

    const absent = await app.inject({
      method: "POST",
      url: "/api/cast/links",
      headers: cookieHeader(session.value),
      payload: { id: "salsa/missing.mp4" },
    });
    assert.equal(absent.statusCode, 404);

    const cast = await app.inject({
      method: "POST",
      url: "/api/cast/links",
      headers: cookieHeader(session.value),
      payload: { id: "salsa/my clip.mp4" },
    });
    assert.equal(cast.statusCode, 200);
    assert.equal(cast.headers["cache-control"], "no-store");
    const link = cast.json();
    assert.equal(link.contentType, "video/mp4");
    assert.equal(link.title, "my clip.mp4");
    assert.equal(link.receiverCompatible, true);
    assert.match(link.streamPath, /^\/api\/video\/salsa\/my%20clip\.mp4\?cast=/);

    const streamed = await app.inject({
      method: "GET",
      url: link.streamPath,
      headers: { range: "bytes=0-4" },
    });
    assert.equal(streamed.statusCode, 206);
    assert.equal(streamed.headers["access-control-allow-origin"], "*");
    assert.equal(streamed.headers["cache-control"], "private");
    assert.deepEqual(streamed.rawPayload, Buffer.from("01234"));

    const reused = link.streamPath.replace("my%20clip.mp4", "second.mp4");
    const wrongVideo = await app.inject({
      method: "GET",
      url: reused,
    });
    assert.equal(wrongVideo.statusCode, 401);

    const preflight = await app.inject({
      method: "OPTIONS",
      url: "/api/video/salsa/first.mp4",
    });
    assert.equal(preflight.statusCode, 204);
    assert.equal(preflight.headers["access-control-allow-origin"], "*");

    const download = await app.inject({
      method: "GET",
      url: "/api/video/salsa/my%20clip.mp4?download=1",
      headers: cookieHeader(session.value),
    });
    assert.equal(download.statusCode, 200);
    assert.equal(download.headers["content-disposition"], contentDispositionAttachment("my clip.mp4"));
    assert.deepEqual(download.rawPayload, videoBytes);

    const anonymousDownload = await app.inject({
      method: "GET",
      url: "/api/video/salsa/first.mp4?download=1",
    });
    assert.equal(anonymousDownload.statusCode, 401);

    await app.close();
  } finally {
    await stores.close();
    await rm(libraryPath, { force: true, recursive: true });
  }
});

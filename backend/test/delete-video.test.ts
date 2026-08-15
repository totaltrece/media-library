import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { DeleteVideoUseCase } from "../src/application/delete-video.js";
import { InvalidMediaIdError } from "../src/application/invalid-media-id-error.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { VideoNotFoundError } from "../src/application/video-not-found-error.js";
import { createApp } from "../src/app.js";
import type { LibraryMediaInstaller, LibraryMediaPresence } from "../src/ports/library-media-installer.js";

test("DELETE /api/videos/:id removes the video, thumbnail, SQLite row, and tag relations", async () => {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-delete-video-"));
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await mkdir(join(libraryPath, "salsa"));
    await mkdir(join(libraryPath, ".ts"));
    await writeFile(join(libraryPath, "salsa", "first.mp4"), "keep-me-out");
    await writeFile(join(libraryPath, "other.mp4"), "other-video");
    await writeFile(join(libraryPath, ".ts", "first.mp4.jpg"), "target-thumb");
    await writeFile(join(libraryPath, ".ts", "other.mp4.jpg"), "other-thumb");

    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.upsertVideo("other.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "jota"]);
    libraryStore.setVideoTags("other.mp4", ["salsa"]);
    libraryStore.upsertTag("bufanda");

    const salsa = libraryStore.findTagByName("salsa")!;
    const jota = libraryStore.findTagByName("jota")!;
    const bufanda = libraryStore.findTagByName("bufanda")!;
    const videoIndex = new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));
    const app = await createApp({
      videoIndex,
      libraryPath,
      libraryStore,
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/videos/salsa/first.mp4",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), { id: "salsa/first.mp4" });
    assert.equal(libraryStore.findVideo("salsa/first.mp4"), null);
    assert.equal(libraryStore.findVideo("other.mp4")?.id, "other.mp4");
    assert.deepEqual(libraryStore.getVideoTags("other.mp4"), ["salsa"]);
    assert.deepEqual(libraryStore.findTagById(salsa.id), salsa);
    assert.deepEqual(libraryStore.findTagById(jota.id), jota);
    assert.deepEqual(libraryStore.findTagById(bufanda.id), bufanda);
    await assert.rejects(() => access(join(libraryPath, "salsa", "first.mp4")));
    await assert.rejects(() => access(join(libraryPath, ".ts", "first.mp4.jpg")));
    assert.equal(await readFile(join(libraryPath, "other.mp4"), "utf8"), "other-video");
    assert.equal(await readFile(join(libraryPath, ".ts", "other.mp4.jpg"), "utf8"), "other-thumb");

    const search = await app.inject({
      method: "GET",
      url: "/api/search",
    });
    const untagged = await app.inject({
      method: "GET",
      url: "/api/search",
    });

    assert.strictEqual(search.statusCode, 200);
    assert.deepEqual(
      search.json().results.map((result: { id: string }) => result.id),
      ["other.mp4"],
    );
    assert.strictEqual(untagged.json().count, 1);

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("DELETE /api/videos/:id returns 404 when the video is not in SQLite", async () => {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-delete-missing-"));
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeFile(join(libraryPath, "orphan.mp4"), "orphan");
    libraryStore.upsertVideo("other.mp4");

    const app = await createApp({
      videoIndex: new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath)),
      libraryPath,
      libraryStore,
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/videos/missing.mp4",
    });

    assert.strictEqual(response.statusCode, 404);
    assert.deepEqual(response.json(), {
      error: {
        message: "Video not found",
      },
    });
    assert.equal(await readFile(join(libraryPath, "orphan.mp4"), "utf8"), "orphan");
    assert.equal(libraryStore.findVideo("other.mp4")?.id, "other.mp4");

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("DELETE /api/videos/:id rejects path traversal and does not delete library files", async () => {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-delete-traversal-"));
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeFile(join(libraryPath, "clip.mp4"), "clip");
    libraryStore.upsertVideo("clip.mp4");

    const app = await createApp({
      videoIndex: new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath)),
      libraryPath,
      libraryStore,
    });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/videos/%2e%2e%2fclip.mp4",
    });

    assert.strictEqual(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      error: {
        message: "Invalid video id",
      },
    });
    assert.equal(libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
    assert.equal(await readFile(join(libraryPath, "clip.mp4"), "utf8"), "clip");

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("DeleteVideoUseCase keeps SQLite when removing the video file fails", async () => {
  const { useCase, installer, libraryStore } = createDeleteHarness();
  libraryStore.upsertVideo("clip.mp4");
  libraryStore.setVideoTags("clip.mp4", ["salsa"]);
  installer.failAt = "video";

  await assert.rejects(() => useCase.execute("clip.mp4"), /video remove failed/);
  assert.equal(libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
  assert.deepEqual(libraryStore.getVideoTags("clip.mp4"), ["salsa"]);
  assert.equal(installer.removedVideo, false);
  assert.equal(installer.removedThumbnail, false);
});

test("DeleteVideoUseCase keeps SQLite when removing the thumbnail fails", async () => {
  const { useCase, installer, libraryStore } = createDeleteHarness();
  libraryStore.upsertVideo("clip.mp4");
  libraryStore.setVideoTags("clip.mp4", ["salsa"]);
  installer.failAt = "thumbnail";

  await assert.rejects(() => useCase.execute("clip.mp4"), /thumbnail remove failed/);
  assert.equal(libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
  assert.deepEqual(libraryStore.getVideoTags("clip.mp4"), ["salsa"]);
  assert.equal(installer.removedVideo, true);
  assert.equal(installer.removedThumbnail, false);
});

test("DeleteVideoUseCase rejects unknown and unsafe ids before touching files", async () => {
  const { useCase, installer, libraryStore } = createDeleteHarness();
  libraryStore.upsertVideo("clip.mp4");

  await assert.rejects(() => useCase.execute("missing.mp4"), (error: unknown) => {
    assert.ok(error instanceof VideoNotFoundError);
    return true;
  });
  await assert.rejects(() => useCase.execute("../clip.mp4"), (error: unknown) => {
    assert.ok(error instanceof InvalidMediaIdError);
    return true;
  });
  assert.equal(installer.removedVideo, false);
  assert.equal(installer.removedThumbnail, false);
  assert.equal(libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
});

test("DeleteVideoUseCase leaves files removed if SQLite delete fails", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");
  const installer = new FakeLibraryMediaInstaller();
  const videoIndex = new InMemoryVideoIndex([]);
  libraryStore.upsertVideo("clip.mp4");
  libraryStore.setVideoTags("clip.mp4", ["salsa"]);

  const failingStore = new Proxy(libraryStore, {
    get(target, property, receiver) {
      if (property === "deleteVideo") {
        return () => {
          throw new Error("sqlite down");
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  const useCase = new DeleteVideoUseCase(installer, failingStore, videoIndex, "/library");

  await assert.rejects(() => useCase.execute("clip.mp4"), /sqlite down/);
  assert.equal(installer.removedVideo, true);
  assert.equal(installer.removedThumbnail, true);
  assert.equal(libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
  assert.deepEqual(libraryStore.getVideoTags("clip.mp4"), ["salsa"]);
});

function createDeleteHarness() {
  const libraryStore = openSqliteLibraryStore(":memory:");
  const installer = new FakeLibraryMediaInstaller();
  const videoIndex = new InMemoryVideoIndex([]);
  const useCase = new DeleteVideoUseCase(installer, libraryStore, videoIndex, "/library");

  return { useCase, installer, libraryStore, videoIndex };
}

class FakeLibraryMediaInstaller implements LibraryMediaInstaller {
  presence: LibraryMediaPresence = { video: true, thumbnail: true };
  removedVideo = false;
  removedThumbnail = false;
  failAt?: "video" | "thumbnail";

  async exists(_videoId: string): Promise<LibraryMediaPresence> {
    return this.presence;
  }

  async installVideo(_sourcePath: string, _videoId: string): Promise<void> {
    throw new Error("installVideo should not be called");
  }

  async installThumbnail(_sourcePath: string, _videoId: string): Promise<void> {
    throw new Error("installThumbnail should not be called");
  }

  async removeVideo(_videoId: string): Promise<void> {
    if (this.failAt === "video") {
      throw new Error("video remove failed");
    }

    this.removedVideo = true;
    this.presence = { ...this.presence, video: false };
  }

  async removeThumbnail(_videoId: string): Promise<void> {
    if (this.failAt === "thumbnail") {
      throw new Error("thumbnail remove failed");
    }

    this.removedThumbnail = true;
    this.presence = { ...this.presence, thumbnail: false };
  }
}

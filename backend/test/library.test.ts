import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { WorkspaceVideoDiscovery } from "../src/adapters/indexer/workspace-video-discovery.js";
import { SqliteLibraryIndexer } from "../src/adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { RefreshLibraryUseCase } from "../src/application/refresh-library.js";
import { SyncNewVideosUseCase } from "../src/application/sync-new-videos.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import type { LibraryStore } from "../src/ports/library-store.js";
import type { VideoDiscovery } from "../src/ports/video-discovery.js";

import { testVideos } from "./fixtures.js";
import { NoopEnsureLibraryMediaUseCase } from "./noop-ensure-library-media.js";
import { tagsWithDefaultColor } from "./tag-colors.js";

async function createLibrary(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-refresh-"));
  await mkdir(join(libraryPath, ".ts"));
  return libraryPath;
}

async function writeVideo(libraryPath: string, relativePath: string): Promise<void> {
  const videoPath = join(libraryPath, ...relativePath.split("/"));
  await mkdir(join(videoPath, ".."), { recursive: true });
  await writeFile(videoPath, "video");
}

function createRefreshUseCase(libraryStore: LibraryStore, libraryPath: string, videoIndex: InMemoryVideoIndex) {
  return new RefreshLibraryUseCase(
    new SyncNewVideosUseCase(new WorkspaceVideoDiscovery(libraryPath), libraryStore, libraryPath),
    new NoopEnsureLibraryMediaUseCase(),
    new SqliteLibraryIndexer(libraryStore, libraryPath),
    videoIndex,
  );
}

async function createRefreshApp(libraryStore: LibraryStore, libraryPath: string) {
  const videoIndex = new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));

  return createApp({
    videoIndex,
    libraryPath,
    refreshLibraryUseCase: createRefreshUseCase(libraryStore, libraryPath, videoIndex),
  });
}

test("POST /api/library/refresh inserts filesystem videos into an empty SQLite store", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "video1.mp4");
    await writeVideo(libraryPath, "video2.mp4");
    await writeVideo(libraryPath, "video3.mp4");

    const app = await createRefreshApp(libraryStore, libraryPath);
    const response = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), { count: 3 });
    assert.deepEqual(
      libraryStore.listVideosWithTags().map((video) => video.tags),
      [[], [], []],
    );

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("POST /api/library/refresh inserts new videos and keeps existing tags", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "video1.mp4");
    await writeVideo(libraryPath, "video2.mp4");
    await writeVideo(libraryPath, "video3.mp4");
    libraryStore.upsertVideo("video1.mp4");
    libraryStore.setVideoTags("video1.mp4", ["salsa", "bea"]);
    libraryStore.upsertVideo("video2.mp4");
    libraryStore.setVideoTags("video2.mp4", ["bachata"]);
    libraryStore.upsertVideo("video3.mp4");
    libraryStore.setVideoTags("video3.mp4", ["linea"]);

    const app = await createRefreshApp(libraryStore, libraryPath);

    await writeVideo(libraryPath, "video4.mp4");
    await writeVideo(libraryPath, "video5.mp4");

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });

    assert.strictEqual(refreshResponse.statusCode, 200);
    assert.deepEqual(refreshResponse.json(), { count: 5 });
    assert.deepEqual(libraryStore.getVideoTags("video1.mp4"), ["bea", "salsa"]);
    assert.deepEqual(libraryStore.getVideoTags("video4.mp4"), []);

    const searchResponse = await app.inject({
      method: "GET",
      url: "/api/search",
    });

    assert.strictEqual(searchResponse.json().count, 5);
    assert.deepEqual(
      searchResponse.json().results.find((result: { id: string }) => result.id === "video5.mp4"),
      {
        id: "video5.mp4",
        name: "video5.mp4",
        thumbnail: "/api/thumbnail/video5.mp4",
        video: "/api/video/video5.mp4",
        tags: [],
        recordedAt: null,
      },
    );

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("POST /api/library/refresh returns 500 and preserves the existing index on failure", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");
  const videoIndex = new InMemoryVideoIndex(testVideos);
  const failingDiscovery: VideoDiscovery = {
    async discoverVideoPaths() {
      throw new Error("Discovery failed");
    },
  };

  const app = await createApp({
    videoIndex,
    libraryPath: join(tmpdir(), "media-library-refresh-missing"),
    refreshLibraryUseCase: new RefreshLibraryUseCase(
      new SyncNewVideosUseCase(failingDiscovery, libraryStore, join(tmpdir(), "media-library-refresh-missing")),
      new NoopEnsureLibraryMediaUseCase(),
      new SqliteLibraryIndexer(libraryStore, join(tmpdir(), "media-library-refresh-missing")),
      videoIndex,
    ),
  });

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });

    assert.strictEqual(response.statusCode, 500);
    assert.match(response.json().error.message, /Discovery failed/);

    const tagsResponse = await app.inject({
      method: "GET",
      url: "/api/tags",
    });

    assert.deepEqual(tagsResponse.json(), {
      count: 5,
      tags: tagsWithDefaultColor(["bachata", "bea", "damian", "linea", "salsa"]),
    });
  } finally {
    await app.close();
    libraryStore.close();
  }
});

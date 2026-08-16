import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { SqliteLibraryIndexer } from "../src/adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { RefreshLibraryUseCase } from "../src/application/refresh-library.js";
import { SyncNewVideosUseCase } from "../src/application/sync-new-videos.js";
import { toMediaId } from "../src/application/media-id.js";
import type { LibraryIndexer } from "../src/ports/library-indexer.js";
import type { VideoDiscovery } from "../src/ports/video-discovery.js";

import { testLibraryPath, testVideos } from "./fixtures.js";

class StubVideoDiscovery implements VideoDiscovery {
  constructor(private readonly result: string[] | Error) {}

  async discoverVideoPaths(): Promise<string[]> {
    if (this.result instanceof Error) {
      throw this.result;
    }

    return this.result;
  }
}

class StubLibraryIndexer implements LibraryIndexer {
  constructor(private readonly result: typeof testVideos | Error) {}

  async index() {
    if (this.result instanceof Error) {
      throw this.result;
    }

    return this.result;
  }
}

test("RefreshLibraryUseCase syncs new videos then reloads the SQLite snapshot", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "bea"]);

    const videoIndex = new InMemoryVideoIndex(testVideos);
    const useCase = new RefreshLibraryUseCase(
      new SyncNewVideosUseCase(
        new StubVideoDiscovery([
          join(testLibraryPath, "salsa", "first.mp4"),
          join(testLibraryPath, "salsa", "fourth.mp4"),
        ]),
        libraryStore,
        testLibraryPath,
      ),
      new SqliteLibraryIndexer(libraryStore, testLibraryPath),
      videoIndex,
    );

    const response = await useCase.execute();

    assert.deepEqual(libraryStore.listVideosWithTags(), [
      { id: "salsa/first.mp4", recordedAt: null, tags: ["salsa", "bea"] },
      { id: "salsa/fourth.mp4", recordedAt: null, tags: [] },
    ]);
    assert.deepEqual(response, { count: 2 });
    assert.deepEqual(
      videoIndex.getVideos().map((video) => ({
        id: toMediaId(video.videoPath, testLibraryPath),
        tags: video.tags,
      })),
      [
        { id: "salsa/first.mp4", tags: ["salsa", "bea"] },
        { id: "salsa/fourth.mp4", tags: [] },
      ],
    );
  } finally {
    libraryStore.close();
  }
});

test("RefreshLibraryUseCase leaves the existing index unchanged when discovery fails", async () => {
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    const videoIndex = new InMemoryVideoIndex(testVideos);
    const useCase = new RefreshLibraryUseCase(
      new SyncNewVideosUseCase(
        new StubVideoDiscovery(new Error("Discovery failed")),
        libraryStore,
        testLibraryPath,
      ),
      new StubLibraryIndexer(testVideos),
      videoIndex,
    );

    await assert.rejects(() => useCase.execute(), /Discovery failed/);
    assert.deepEqual(videoIndex.getVideos(), testVideos);
    assert.deepEqual(libraryStore.listVideos(), []);
  } finally {
    libraryStore.close();
  }
});

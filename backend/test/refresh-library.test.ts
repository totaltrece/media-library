import assert from "node:assert/strict";
import { test } from "node:test";

import type { IndexedVideo } from "@media-library/indexer";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { RefreshLibraryUseCase } from "../src/application/refresh-library.js";
import type { LibraryIndexer } from "../src/ports/library-indexer.js";

import { testVideos } from "./fixtures.js";

class StubLibraryIndexer implements LibraryIndexer {
  constructor(
    private readonly results: IndexedVideo[][] | Error,
    private indexCalls = 0,
  ) {}

  get indexCallCount(): number {
    return this.indexCalls;
  }

  async index(): Promise<IndexedVideo[]> {
    this.indexCalls += 1;

    if (this.results instanceof Error) {
      throw this.results;
    }

    const result = this.results[this.indexCalls - 1];

    if (result === undefined) {
      throw new Error("No more stubbed index results");
    }

    return result;
  }
}

test("RefreshLibraryUseCase replaces the in-memory index with newly indexed videos", async () => {
  const refreshedVideos = [
    testVideos[0]!,
    {
      videoPath: testVideos[0]!.videoPath.replace("first.mp4", "fourth.mp4"),
      tags: ["kizomba"],
    },
  ];
  const libraryIndexer = new StubLibraryIndexer([refreshedVideos]);
  const videoIndex = new InMemoryVideoIndex(testVideos);
  const useCase = new RefreshLibraryUseCase(libraryIndexer, videoIndex);

  const response = await useCase.execute();

  assert.deepEqual(response, { count: 2 });
  assert.strictEqual(videoIndex.getVideos(), refreshedVideos);
  assert.strictEqual(libraryIndexer.indexCallCount, 1);
});

test("RefreshLibraryUseCase leaves the existing index unchanged when indexing fails", async () => {
  const libraryIndexer = new StubLibraryIndexer(new Error("Indexing failed"));
  const videoIndex = new InMemoryVideoIndex(testVideos);
  const useCase = new RefreshLibraryUseCase(libraryIndexer, videoIndex);

  await assert.rejects(() => useCase.execute(), /Indexing failed/);
  assert.deepEqual(videoIndex.getVideos(), testVideos);
});

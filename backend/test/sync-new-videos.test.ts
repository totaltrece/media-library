import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { WorkspaceVideoDiscovery } from "../src/adapters/indexer/workspace-video-discovery.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { SyncNewVideosUseCase } from "../src/application/sync-new-videos.js";
import type { LibraryStore } from "../src/ports/library-store.js";

async function createLibrary(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-sync-"));
  await mkdir(join(libraryPath, ".ts"));
  return libraryPath;
}

async function writeVideo(libraryPath: string, relativePath: string): Promise<void> {
  const videoPath = join(libraryPath, ...relativePath.split("/"));
  await mkdir(join(videoPath, ".."), { recursive: true });
  await writeFile(videoPath, "video");
}

async function writeTagSpacesMetadata(libraryPath: string, fileName: string, titles: string[]): Promise<void> {
  await writeFile(
    join(libraryPath, ".ts", `${fileName}.json`),
    JSON.stringify({
      tags: titles.map((title) => ({ title })),
    }),
  );
}

function syncNewVideos(libraryPath: string, libraryStore: LibraryStore) {
  return new SyncNewVideosUseCase(
    new WorkspaceVideoDiscovery(libraryPath),
    libraryStore,
    libraryPath,
  ).execute();
}

test("an empty SQLite store inserts every video discovered on the filesystem", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "video1.mp4");
    await writeVideo(libraryPath, "video2.mp4");
    await writeVideo(libraryPath, "video3.mp4");

    const result = await syncNewVideos(libraryPath, libraryStore);

    assert.deepEqual(result, { discovered: 3, inserted: 3 });
    assert.deepEqual(libraryStore.listVideosWithTags(), [
      { id: "video1.mp4", recordedAt: null, tags: [] },
      { id: "video2.mp4", recordedAt: null, tags: [] },
      { id: "video3.mp4", recordedAt: null, tags: [] },
    ]);
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("new filesystem videos are inserted without changing existing tags", async () => {
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

    await writeVideo(libraryPath, "video4.mp4");
    await writeVideo(libraryPath, "video5.mp4");

    const result = await syncNewVideos(libraryPath, libraryStore);

    assert.deepEqual(result, { discovered: 5, inserted: 2 });
    assert.deepEqual(libraryStore.listVideosWithTags(), [
      { id: "video1.mp4", recordedAt: null, tags: ["bea", "salsa"] },
      { id: "video2.mp4", recordedAt: null, tags: ["bachata"] },
      { id: "video3.mp4", recordedAt: null, tags: ["linea"] },
      { id: "video4.mp4", recordedAt: null, tags: [] },
      { id: "video5.mp4", recordedAt: null, tags: [] },
    ]);
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("running the sync twice does not duplicate videos or change tags", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "video1.mp4");
    libraryStore.upsertVideo("video1.mp4");
    libraryStore.setVideoTags("video1.mp4", ["salsa"]);

    const firstResult = await syncNewVideos(libraryPath, libraryStore);
    const secondResult = await syncNewVideos(libraryPath, libraryStore);

    assert.deepEqual(firstResult, { discovered: 1, inserted: 0 });
    assert.deepEqual(secondResult, { discovered: 1, inserted: 0 });
    assert.deepEqual(libraryStore.listVideos(), [{ id: "video1.mp4", recordedAt: null }]);
    assert.deepEqual(libraryStore.getVideoTags("video1.mp4"), ["salsa"]);
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("a video without a TagSpaces sidecar is still inserted", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "missing.mp4");

    const result = await syncNewVideos(libraryPath, libraryStore);

    assert.deepEqual(result, { discovered: 1, inserted: 1 });
    assert.deepEqual(libraryStore.listVideosWithTags(), [{ id: "missing.mp4", recordedAt: null, tags: [] }]);
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("videos missing from the filesystem are not deleted from SQLite", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "kept.mp4");
    libraryStore.upsertVideo("kept.mp4");
    libraryStore.setVideoTags("kept.mp4", ["salsa"]);
    libraryStore.upsertVideo("removed.mp4");
    libraryStore.setVideoTags("removed.mp4", ["bachata"]);

    const result = await syncNewVideos(libraryPath, libraryStore);

    assert.deepEqual(result, { discovered: 1, inserted: 0 });
    assert.deepEqual(libraryStore.listVideosWithTags(), [
      { id: "kept.mp4", recordedAt: null, tags: ["salsa"] },
      { id: "removed.mp4", recordedAt: null, tags: ["bachata"] },
    ]);
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("existing TagSpaces sidecars are not used to assign tags during sync", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "existing.mp4");
    await writeVideo(libraryPath, "new-video.mp4");
    await writeTagSpacesMetadata(libraryPath, "existing.mp4", ["tagspaces-existing"]);
    await writeTagSpacesMetadata(libraryPath, "new-video.mp4", ["tagspaces-new"]);
    libraryStore.upsertVideo("existing.mp4");
    libraryStore.setVideoTags("existing.mp4", ["sqlite-tag"]);

    await syncNewVideos(libraryPath, libraryStore);

    assert.deepEqual(libraryStore.getVideoTags("existing.mp4"), ["sqlite-tag"]);
    assert.deepEqual(libraryStore.getVideoTags("new-video.mp4"), []);
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

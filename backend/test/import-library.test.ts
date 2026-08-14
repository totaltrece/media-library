import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { WorkspaceLibraryIndexer } from "../src/adapters/indexer/workspace-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { ImportLibraryUseCase } from "../src/application/import-library.js";
import { uniquePreserveOrder } from "../src/application/unique-preserve-order.js";
import type { LibraryStore } from "../src/ports/library-store.js";

async function createLibrary(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-import-"));
  await mkdir(join(libraryPath, ".ts"));
  return libraryPath;
}

async function writeVideo(libraryPath: string, relativePath: string, contents = "video"): Promise<void> {
  const videoPath = join(libraryPath, ...relativePath.split("/"));
  await mkdir(join(videoPath, ".."), { recursive: true });
  await writeFile(videoPath, contents);
}

async function writeTagSpacesMetadata(
  libraryPath: string,
  fileName: string,
  titles: Array<string | { title?: unknown }>,
): Promise<void> {
  const tags = titles.map((title) => (typeof title === "string" ? { title } : title));
  await writeFile(join(libraryPath, ".ts", `${fileName}.json`), JSON.stringify({ tags }));
}

async function importLibrary(libraryPath: string, libraryStore: LibraryStore) {
  return new ImportLibraryUseCase(
    new WorkspaceLibraryIndexer(libraryPath),
    libraryStore,
    libraryPath,
  ).execute();
}

test("uniquePreserveOrder keeps the first occurrence of each value", () => {
  assert.deepEqual(uniquePreserveOrder(["salsa", "casino", "salsa", "clase"]), [
    "salsa",
    "casino",
    "clase",
  ]);
});

test("imports a video with several TagSpaces tag titles", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "salsa/first.mp4");
    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["salsa", "bea", "linea"]);

    const result = await importLibrary(libraryPath, store);

    assert.deepEqual(result, {
      discovered: 1,
      imported: 1,
      withoutMetadata: 0,
      withoutTags: 0,
      tagsCreated: 3,
      errors: [],
    });
    assert.deepEqual(store.listVideosWithTags(), [
      {
        id: "salsa/first.mp4",
        tags: ["salsa", "bea", "linea"],
      },
    ]);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("imports a video without TagSpaces metadata and leaves tags empty", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "missing.mp4");

    const result = await importLibrary(libraryPath, store);

    assert.strictEqual(result.withoutMetadata, 1);
    assert.strictEqual(result.withoutTags, 1);
    assert.deepEqual(store.listVideosWithTags(), [{ id: "missing.mp4", tags: [] }]);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("imports a video whose TagSpaces metadata has no tags", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "empty.mp4");
    await writeTagSpacesMetadata(libraryPath, "empty.mp4", []);

    const result = await importLibrary(libraryPath, store);

    assert.strictEqual(result.withoutMetadata, 0);
    assert.strictEqual(result.withoutTags, 1);
    assert.deepEqual(store.listVideosWithTags(), [{ id: "empty.mp4", tags: [] }]);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("deduplicates TagSpaces titles while preserving first-seen order", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "dupes.mp4");
    await writeTagSpacesMetadata(libraryPath, "dupes.mp4", ["salsa", "casino", "salsa", "clase"]);

    await importLibrary(libraryPath, store);

    assert.deepEqual(store.getVideoTags("dupes.mp4"), ["salsa", "casino", "clase"]);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("reuses existing tags instead of creating duplicates", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "first.mp4");
    await writeVideo(libraryPath, "second.mp4");
    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["salsa", "bea"]);
    await writeTagSpacesMetadata(libraryPath, "second.mp4", ["salsa", "linea"]);

    const result = await importLibrary(libraryPath, store);

    assert.strictEqual(result.tagsCreated, 3);
    assert.deepEqual(
      store.listTags().map((tag) => tag.name),
      ["bea", "linea", "salsa"],
    );
    assert.strictEqual(store.listTags().filter((tag) => tag.name === "salsa").length, 1);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("running the import twice does not duplicate videos, tags, or relations", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "first.mp4");
    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["salsa", "bea"]);

    await importLibrary(libraryPath, store);
    const secondResult = await importLibrary(libraryPath, store);

    assert.strictEqual(secondResult.imported, 1);
    assert.strictEqual(secondResult.tagsCreated, 0);
    assert.deepEqual(store.listVideos(), [{ id: "first.mp4" }]);
    assert.deepEqual(
      store.listTags().map((tag) => tag.name),
      ["bea", "salsa"],
    );
    assert.deepEqual(store.getVideoTags("first.mp4"), ["salsa", "bea"]);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("reimporting replaces a video's tags with the current TagSpaces list", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "first.mp4");
    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["salsa", "bea"]);
    await importLibrary(libraryPath, store);

    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["linea"]);
    await importLibrary(libraryPath, store);

    assert.deepEqual(store.getVideoTags("first.mp4"), ["linea"]);
    assert.deepEqual(
      store.listTags().map((tag) => tag.name),
      ["bea", "linea", "salsa"],
    );
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("a video import error does not leave partial tag relations", async () => {
  const libraryPath = await createLibrary();
  const store = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "broken.mp4");
    await writeTagSpacesMetadata(libraryPath, "broken.mp4", ["salsa", ""]);

    const result = await importLibrary(libraryPath, store);

    assert.strictEqual(result.imported, 0);
    assert.strictEqual(result.errors.length, 1);
    assert.strictEqual(result.errors[0]?.videoId, "broken.mp4");
    assert.match(result.errors[0]?.message ?? "", /Tag name must not be empty/);
    assert.deepEqual(store.findVideo("broken.mp4"), { id: "broken.mp4" });
    assert.deepEqual(store.getVideoTags("broken.mp4"), []);
    assert.deepEqual(store.listTags(), []);
  } finally {
    store.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

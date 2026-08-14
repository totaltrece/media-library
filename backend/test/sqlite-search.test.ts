import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { indexLibrary } from "@media-library/indexer";
import { searchVideos } from "@media-library/search";

import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { WorkspaceLibraryIndexer } from "../src/adapters/indexer/workspace-library-indexer.js";
import { SqliteLibraryIndexer } from "../src/adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { ImportLibraryUseCase } from "../src/application/import-library.js";
import { toMediaId } from "../src/application/media-id.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { createApp } from "../src/app.js";
import type { LibraryStore } from "../src/ports/library-store.js";

const samplesLibraryPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../samples/indexer-library",
);

async function createLibrary(): Promise<string> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-sqlite-search-"));
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

async function createAppFromStore(libraryStore: LibraryStore, libraryPath: string) {
  return createApp({
    videoIndex: new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath)),
    libraryPath,
    libraryIndexer: new SqliteLibraryIndexer(libraryStore, libraryPath),
  });
}

function searchResultIds(body: { results: Array<{ id: string }> }): string[] {
  return body.results.map((result) => result.id);
}

test("the backend can start using a temporary SQLite database", async () => {
  const libraryPath = await createLibrary();
  const sqlitePath = join(libraryPath, "library.sqlite");
  const libraryStore = openSqliteLibraryStore(sqlitePath);

  try {
    await writeVideo(libraryPath, "salsa/first.mp4");
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "bea"]);

    const app = await createAppFromStore(libraryStore, libraryPath);

    const healthResponse = await app.inject({
      method: "GET",
      url: "/api/health",
    });
    const searchResponse = await app.inject({
      method: "GET",
      url: "/api/search?tag=bea",
    });

    assert.strictEqual(healthResponse.statusCode, 200);
    assert.deepEqual(healthResponse.json(), { status: "ok" });
    assert.strictEqual(searchResponse.statusCode, 200);
    assert.strictEqual(searchResponse.json().count, 1);
    assert.strictEqual(searchResponse.json().results[0]?.id, "salsa/first.mp4");
    assert.deepEqual(searchResponse.json().results[0]?.tags, ["salsa", "bea"]);

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("search returns tags from SQLite rather than TagSpaces sidecars", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "salsa/first.mp4");
    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["tagspaces-only"]);
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["sqlite-tag"]);

    const app = await createAppFromStore(libraryStore, libraryPath);

    const sqliteSearch = await app.inject({
      method: "GET",
      url: "/api/search?tag=sqlite-tag",
    });
    const tagSpacesSearch = await app.inject({
      method: "GET",
      url: "/api/search?tag=tagspaces-only",
    });
    const unfilteredSearch = await app.inject({
      method: "GET",
      url: "/api/search",
    });

    assert.strictEqual(sqliteSearch.json().count, 1);
    assert.deepEqual(sqliteSearch.json().results[0]?.tags, ["sqlite-tag"]);
    assert.strictEqual(tagSpacesSearch.json().count, 0);
    assert.deepEqual(unfilteredSearch.json().results[0]?.tags, ["sqlite-tag"]);

    const indexedFromTagSpaces = await indexLibrary(libraryPath);
    assert.deepEqual(indexedFromTagSpaces[0]?.tags, ["tagspaces-only"]);

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("a video without a TagSpaces sidecar can still be returned from SQLite", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "missing.mp4");
    libraryStore.upsertVideo("missing.mp4");
    libraryStore.setVideoTags("missing.mp4", ["imported"]);

    const app = await createAppFromStore(libraryStore, libraryPath);
    const response = await app.inject({
      method: "GET",
      url: "/api/search?tag=imported",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.strictEqual(response.json().count, 1);
    assert.strictEqual(response.json().results[0]?.id, "missing.mp4");
    assert.deepEqual(response.json().results[0]?.tags, ["imported"]);

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("a video without tags does not break search", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("empty.mp4");
    libraryStore.setVideoTags("empty.mp4", []);
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa"]);

    const app = await createAppFromStore(libraryStore, libraryPath);
    const allVideos = await app.inject({
      method: "GET",
      url: "/api/search",
    });
    const salsaVideos = await app.inject({
      method: "GET",
      url: "/api/search?tag=salsa",
    });

    assert.strictEqual(allVideos.statusCode, 200);
    assert.strictEqual(allVideos.json().count, 2);
    assert.deepEqual(searchResultIds(allVideos.json()), ["empty.mp4", "salsa/first.mp4"]);
    assert.deepEqual(allVideos.json().results[0]?.tags, []);
    assert.strictEqual(salsaVideos.json().count, 1);
    assert.strictEqual(salsaVideos.json().results[0]?.id, "salsa/first.mp4");

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("searching several tags still requires every requested tag", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "bea", "linea"]);
    libraryStore.upsertVideo("salsa/second.mp4");
    libraryStore.setVideoTags("salsa/second.mp4", ["salsa", "damian"]);
    libraryStore.upsertVideo("bachata/third.mp4");
    libraryStore.setVideoTags("bachata/third.mp4", ["bachata", "bea"]);

    const app = await createAppFromStore(libraryStore, libraryPath);
    const response = await app.inject({
      method: "GET",
      url: "/api/search?tag=salsa&tag=bea",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      query: {
        tags: ["salsa", "bea"],
      },
      count: 1,
      results: [
        {
          id: "salsa/first.mp4",
          name: "first.mp4",
          thumbnail: "/api/thumbnail/salsa/first.mp4",
          video: "/api/video/salsa/first.mp4",
          tags: ["salsa", "bea", "linea"],
        },
      ],
    });

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("SQLite-backed search preserves the previous result order", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "salsa/first.mp4");
    await writeVideo(libraryPath, "salsa/second.mp4");
    await writeVideo(libraryPath, "bachata/third.mp4");
    await writeTagSpacesMetadata(libraryPath, "first.mp4", ["salsa", "bea"]);
    await writeTagSpacesMetadata(libraryPath, "second.mp4", ["salsa"]);
    await writeTagSpacesMetadata(libraryPath, "third.mp4", ["bachata", "bea"]);

    await new ImportLibraryUseCase(
      new WorkspaceLibraryIndexer(libraryPath),
      libraryStore,
      libraryPath,
    ).execute();

    const previousMatches = searchVideos(await indexLibrary(libraryPath), { tags: ["bea"] });
    const app = await createAppFromStore(libraryStore, libraryPath);
    const response = await app.inject({
      method: "GET",
      url: "/api/search?tag=bea",
    });

    assert.deepEqual(
      searchResultIds(response.json()),
      previousMatches.map((video) => toMediaId(video.videoPath, libraryPath)),
    );

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("SQLite-backed search keeps the existing search endpoint contract", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    libraryStore.upsertVideo("salsa/first.mp4");
    libraryStore.setVideoTags("salsa/first.mp4", ["salsa", "bea", "linea"]);

    const app = await createAppFromStore(libraryStore, libraryPath);
    const response = await app.inject({
      method: "GET",
      url: "/api/search?tag=SALSA&tag=bea",
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      query: {
        tags: ["SALSA", "bea"],
      },
      count: 1,
      results: [
        {
          id: "salsa/first.mp4",
          name: "first.mp4",
          thumbnail: "/api/thumbnail/salsa/first.mp4",
          video: "/api/video/salsa/first.mp4",
          tags: ["salsa", "bea", "linea"],
        },
      ],
    });
    assert.doesNotMatch(JSON.stringify(response.json()), /videoPath/);
    assert.doesNotMatch(JSON.stringify(response.json()), /metadataPath/);

    await app.close();
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test("imported TagSpaces libraries produce the same search results from SQLite", async () => {
  const libraryPath = await createLibrary();
  const libraryStore = openSqliteLibraryStore(":memory:");

  try {
    await writeVideo(libraryPath, "PXL_20260130_200612818.TS.mp4");
    await writeVideo(libraryPath, "PXL_20260702_201741381.TS.mp4");
    await writeVideo(libraryPath, "PXL_20260703_190605043.TS.mp4");
    await writeVideo(libraryPath, "PXL_20260703_202126509.TS.mp4");
    await writeTagSpacesMetadata(libraryPath, "PXL_20260130_200612818.TS.mp4", [
      "pascual",
      "gabriela",
      "salsa",
      "mano-cadera",
      "rosca",
    ]);
    await writeTagSpacesMetadata(libraryPath, "PXL_20260702_201741381.TS.mp4", [
      "salsa",
      "linea",
      "jota",
      "estela",
      "intensivo",
      "cambio-lado",
    ]);
    await writeTagSpacesMetadata(libraryPath, "PXL_20260703_190605043.TS.mp4", [
      "salsa",
      "damian",
      "lamari",
      "70",
    ]);
    await writeTagSpacesMetadata(libraryPath, "PXL_20260703_202126509.TS.mp4", [
      "salsa",
      "on2",
      "gabriela",
      "pedro",
    ]);

    await new ImportLibraryUseCase(
      new WorkspaceLibraryIndexer(libraryPath),
      libraryStore,
      libraryPath,
    ).execute();

    const queries = [[], ["salsa"], ["gabriela"], ["salsa", "gabriela"], ["linea", "jota"]];
    const previousVideos = await indexLibrary(libraryPath);
    const sqliteVideos = toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath);

    for (const tags of queries) {
      const previousMatches = searchVideos(previousVideos, { tags });
      const sqliteMatches = searchVideos(sqliteVideos, { tags });

      assert.deepEqual(
        sqliteMatches.map((video) => ({
          id: toMediaId(video.videoPath, libraryPath),
          tags: video.tags,
        })),
        previousMatches.map((video) => ({
          id: toMediaId(video.videoPath, libraryPath),
          tags: video.tags,
        })),
      );
    }
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
});

test(
  "sample library search results match after importing into SQLite",
  { skip: !existsSync(samplesLibraryPath) },
  async () => {
    const libraryStore = openSqliteLibraryStore(":memory:");

    try {
      await new ImportLibraryUseCase(
        new WorkspaceLibraryIndexer(samplesLibraryPath),
        libraryStore,
        samplesLibraryPath,
      ).execute();

      const previousVideos = await indexLibrary(samplesLibraryPath);
      const sqliteVideos = toIndexedVideos(libraryStore.listVideosWithTags(), samplesLibraryPath);
      const queries = [[], ["salsa"], ["gabriela"], ["salsa", "gabriela"], ["linea", "jota"]];

      for (const tags of queries) {
        const previousMatches = searchVideos(previousVideos, { tags });
        const sqliteMatches = searchVideos(sqliteVideos, { tags });

        assert.deepEqual(
          sqliteMatches.map((video) => ({
            id: toMediaId(video.videoPath, samplesLibraryPath),
            tags: video.tags,
          })),
          previousMatches.map((video) => ({
            id: toMediaId(video.videoPath, samplesLibraryPath),
            tags: video.tags,
          })),
        );
      }
    } finally {
      libraryStore.close();
    }
  },
);

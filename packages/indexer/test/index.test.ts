import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { join, resolve } from "node:path";

import { discoverVideoPaths, indexLibrary } from "../src/index.js";

const libraryPath = resolve(process.cwd(), "../../samples/indexer-library");

test("indexes real TagSpaces metadata and extracts only tag titles", async () => {
  const indexedVideos = await indexLibrary(libraryPath);

  assert.deepEqual(indexedVideos, [
    {
      videoPath: resolve(libraryPath, "PXL_20260130_200612818.TS.mp4"),
      metadataPath: resolve(
        libraryPath,
        ".ts/PXL_20260130_200612818.TS.mp4.json",
      ),
      thumbnailPath: resolve(
        libraryPath,
        ".ts/PXL_20260130_200612818.TS.mp4.jpg",
      ),
      tags: [
        "pascual",
        "gabriela",
        "salsa",
        "mano-cadera",
        "rosca",
      ],
    },
    {
      videoPath: resolve(libraryPath, "PXL_20260702_201741381.TS.mp4"),
      metadataPath: resolve(libraryPath, ".ts/PXL_20260702_201741381.TS.mp4.json"),
      thumbnailPath: resolve(libraryPath, ".ts/PXL_20260702_201741381.TS.mp4.jpg"),
      tags: ["salsa", "linea", "jota", "estela", "intensivo", "cambio-lado"],
    },
    {
      videoPath: resolve(libraryPath, "PXL_20260703_190605043.TS.mp4"),
      metadataPath: resolve(libraryPath, ".ts/PXL_20260703_190605043.TS.mp4.json"),
      thumbnailPath: resolve(libraryPath, ".ts/PXL_20260703_190605043.TS.mp4.jpg"),
      tags: ["salsa", "damian", "lamari", "70"],
    },
    {
      videoPath: resolve(libraryPath, "PXL_20260703_202126509.TS.mp4"),
      metadataPath: resolve(libraryPath, ".ts/PXL_20260703_202126509.TS.mp4.json"),
      thumbnailPath: resolve(libraryPath, ".ts/PXL_20260703_202126509.TS.mp4.jpg"),
      tags: ["salsa", "on2", "gabriela", "pedro"],
    },

  ]);
});

test("discovers video paths without reading TagSpaces metadata", async () => {
  const temporaryLibraryPath = await mkdtemp(join(tmpdir(), "media-library-discover-"));

  try {
    await mkdir(join(temporaryLibraryPath, ".ts"));
    await writeFile(join(temporaryLibraryPath, "first.mp4"), "video");
    await writeFile(join(temporaryLibraryPath, "second.mov"), "video");
    await writeFile(join(temporaryLibraryPath, "notes.txt"), "ignore");
    await writeFile(
      join(temporaryLibraryPath, ".ts", "first.mp4.json"),
      JSON.stringify({ tags: [{ title: "should-not-be-read" }] }),
    );

    const videoPaths = await discoverVideoPaths(temporaryLibraryPath);

    assert.deepEqual(videoPaths, [
      join(temporaryLibraryPath, "first.mp4"),
      join(temporaryLibraryPath, "second.mov"),
    ]);
  } finally {
    await rm(temporaryLibraryPath, { force: true, recursive: true });
  }
});

test("continues indexing when metadata is missing or invalid", async () => {
  const temporaryLibraryPath = await mkdtemp(join(tmpdir(), "media-library-indexer-"));

  try {
    await mkdir(join(temporaryLibraryPath, ".ts"));
    await writeFile(join(temporaryLibraryPath, "invalid.mp4"), "video");
    await writeFile(join(temporaryLibraryPath, "missing.mp4"), "video");
    await writeFile(join(temporaryLibraryPath, ".ts", "invalid.mp4.json"), "{ invalid JSON");

    const indexedVideos = await indexLibrary(temporaryLibraryPath);

    assert.deepEqual(indexedVideos, [
      {
        videoPath: join(temporaryLibraryPath, "invalid.mp4"),
        metadataPath: join(temporaryLibraryPath, ".ts", "invalid.mp4.json"),
        thumbnailPath: undefined,
        tags: [],
      },
      {
        videoPath: join(temporaryLibraryPath, "missing.mp4"),
        metadataPath: undefined,
        thumbnailPath: undefined,
        tags: [],
      },
    ]);
  } finally {
    await rm(temporaryLibraryPath, { force: true, recursive: true });
  }
});

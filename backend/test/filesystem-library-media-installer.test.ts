import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FilesystemLibraryMediaInstaller } from "../src/adapters/filesystem/filesystem-library-media-installer.js";

test("FilesystemLibraryMediaInstaller copies video and thumbnail without overwriting", async () => {
  const root = await mkdtemp(join(tmpdir(), "media-library-installer-"));
  const libraryPath = join(root, "library");
  const sourceDir = join(root, "source");
  await mkdir(libraryPath);
  await mkdir(sourceDir);

  const videoSource = join(sourceDir, "video.bin");
  const thumbSource = join(sourceDir, "thumb.jpg");
  await writeFile(videoSource, "processed-video");
  await writeFile(thumbSource, "processed-thumb");

  const installer = new FilesystemLibraryMediaInstaller(libraryPath);

  try {
    assert.deepEqual(await installer.exists("clip.mp4"), { video: false, thumbnail: false });

    await installer.installVideo(videoSource, "clip.mp4");
    await installer.installThumbnail(thumbSource, "clip.mp4");

    assert.equal(await readFile(join(libraryPath, "clip.mp4"), "utf8"), "processed-video");
    assert.equal(await readFile(join(libraryPath, ".ts", "clip.mp4.jpg"), "utf8"), "processed-thumb");
    assert.deepEqual(await installer.exists("clip.mp4"), { video: true, thumbnail: true });

    await assert.rejects(() => installer.installVideo(videoSource, "clip.mp4"), { code: "EEXIST" });
    await assert.rejects(() => installer.installThumbnail(thumbSource, "clip.mp4"), { code: "EEXIST" });
    assert.equal(await readFile(join(libraryPath, "clip.mp4"), "utf8"), "processed-video");

    await installer.removeThumbnail("clip.mp4");
    await installer.removeVideo("clip.mp4");
    await installer.removeVideo("clip.mp4");
    assert.deepEqual(await installer.exists("clip.mp4"), { video: false, thumbnail: false });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

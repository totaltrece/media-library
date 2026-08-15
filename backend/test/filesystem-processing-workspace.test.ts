import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FilesystemProcessingWorkspace } from "../src/adapters/filesystem/filesystem-processing-workspace.js";
import { buildProcessingJobPaths } from "../src/application/processing-job-paths.js";

test("FilesystemProcessingWorkspace creates and discards a job directory under the temp root", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "media-library-workspace-"));
  const workspace = new FilesystemProcessingWorkspace(tempRoot);

  try {
    const paths = await workspace.prepareJob("job-1");
    assert.deepEqual(paths, buildProcessingJobPaths(tempRoot, "job-1"));
    await writeFile(paths.sourcePath, "source");

    await workspace.discardJob("job-1");
    await assert.rejects(() => writeFile(join(paths.directory, "gone.txt"), "x"), /ENOENT/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("FilesystemProcessingWorkspace discards one job without touching a sibling job", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "upload temp "));
  const workspace = new FilesystemProcessingWorkspace(tempRoot);

  try {
    const first = await workspace.prepareJob("job-1");
    const second = await workspace.prepareJob("job-2");
    await writeFile(first.sourcePath, "one");
    await writeFile(second.sourcePath, "two");

    await workspace.discardJob("job-1");
    await assert.rejects(() => writeFile(join(first.directory, "gone.txt"), "x"), /ENOENT/);
    await writeFile(join(second.directory, "still-here.txt"), "ok");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("FilesystemProcessingWorkspace rejects unsafe job ids instead of deleting outside the temp root", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "media-library-workspace-unsafe-"));
  const workspace = new FilesystemProcessingWorkspace(tempRoot);
  const outside = join(tempRoot, "..", "outside.txt");

  try {
    await mkdir(tempRoot, { recursive: true });
    await writeFile(outside, "keep");
    await assert.rejects(() => workspace.prepareJob("../outside"), /Invalid processing job id/);
    await assert.rejects(() => workspace.discardJob("job/nested"), /Invalid processing job id/);
    await writeFile(outside, "keep");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(outside, { force: true });
  }
});

test("FilesystemProcessingWorkspace copies a source without modifying the original", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "media-library-workspace-stage-"));
  const workspace = new FilesystemProcessingWorkspace(tempRoot);
  const originalPath = join(tempRoot, "original clip.mp4");

  try {
    await writeFile(originalPath, "original-bytes");
    const paths = await workspace.prepareJob("job-1");
    await workspace.stageSource("job-1", originalPath);

    assert.equal(await readFile(originalPath, "utf8"), "original-bytes");
    assert.equal(await readFile(paths.sourcePath, "utf8"), "original-bytes");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

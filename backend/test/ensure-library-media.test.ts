import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { WorkspaceVideoDiscovery } from "../src/adapters/indexer/workspace-video-discovery.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { EnsureLibraryMediaUseCase } from "../src/application/ensure-library-media.js";
import { recordedAtFromFileName } from "../src/application/filename-recorded-at-fallback.js";
import { resolveLibraryThumbnailPath } from "../src/application/library-media-paths.js";
import { toStoredRecordedAt } from "../src/application/resolve-canonical-upload-name.js";
import type { VideoConvertOptions, VideoProbeResult, VideoProcessor } from "../src/ports/video-processor.js";

const RECORDING_TIME = "2026-03-14T19:04:31.123Z";

test("ensure fills a missing recorded_at from ffprobe metadata", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    await writeLibraryVideo(libraryPath, "clip.mp4");
    libraryStore.upsertVideo("clip.mp4");
    processor.setRecordingTime("clip.mp4", RECORDING_TIME);

    const result = await ensure(libraryPath, libraryStore, processor);

    assert.equal(result.datesFilled, 1);
    assert.equal(libraryStore.findVideo("clip.mp4")?.recordedAt, toStoredRecordedAt(RECORDING_TIME));
  });
});

test("ensure uses the filename date when ffprobe has no reliable timestamp", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    const videoId = "PXL_20260813_213639202.TS.mp4";
    await writeLibraryVideo(libraryPath, videoId);
    libraryStore.upsertVideo(videoId);

    const result = await ensure(libraryPath, libraryStore, processor);

    assert.equal(result.datesFilled, 1);
    assert.equal(libraryStore.findVideo(videoId)?.recordedAt, recordedAtFromFileName(videoId));
  });
});

test("ensure does not overwrite an existing recorded_at", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    await writeLibraryVideo(libraryPath, "clip.mp4");
    libraryStore.upsertVideo("clip.mp4", "2020-01-01T12:00:00.000Z");
    processor.setRecordingTime("clip.mp4", RECORDING_TIME);

    const result = await ensure(libraryPath, libraryStore, processor);

    assert.equal(result.datesFilled, 0);
    assert.equal(libraryStore.findVideo("clip.mp4")?.recordedAt, "2020-01-01T12:00:00.000Z");
    assert.equal(processor.probeCount, 0);
  });
});

test("ensure generates a missing TagSpaces thumbnail and leaves an existing one", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    await writeLibraryVideo(libraryPath, "missing.mp4");
    await writeLibraryVideo(libraryPath, "present.mp4");
    libraryStore.upsertVideo("missing.mp4");
    libraryStore.upsertVideo("present.mp4");

    const presentThumbnail = resolveLibraryThumbnailPath(libraryPath, "present.mp4");
    assert.ok(presentThumbnail);
    await mkdir(dirname(presentThumbnail), { recursive: true });
    await writeFile(presentThumbnail, "existing-thumb");

    const result = await ensure(libraryPath, libraryStore, processor);
    const missingThumbnail = resolveLibraryThumbnailPath(libraryPath, "missing.mp4");
    assert.ok(missingThumbnail);

    assert.equal(result.thumbnailsGenerated, 1);
    assert.equal(await readFile(missingThumbnail, "utf8"), "generated-thumb");
    assert.equal(await readFile(presentThumbnail, "utf8"), "existing-thumb");
    assert.deepEqual(processor.thumbnailOutputs, [missingThumbnail]);
  });
});

test("ensure continues after a probe error on another video", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    await writeLibraryVideo(libraryPath, "bad.mp4");
    await writeLibraryVideo(libraryPath, "good.mp4");
    libraryStore.upsertVideo("bad.mp4");
    libraryStore.upsertVideo("good.mp4");
    processor.fail("bad.mp4");
    processor.setRecordingTime("good.mp4", RECORDING_TIME);

    const result = await ensure(libraryPath, libraryStore, processor);

    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.videoId, "bad.mp4");
    assert.equal(result.datesFilled, 1);
    assert.equal(libraryStore.findVideo("good.mp4")?.recordedAt, toStoredRecordedAt(RECORDING_TIME));
  });
});

function ensure(
  libraryPath: string,
  libraryStore: ReturnType<typeof openSqliteLibraryStore>,
  processor: FakeVideoProcessor,
) {
  return new EnsureLibraryMediaUseCase(
    new WorkspaceVideoDiscovery(libraryPath),
    libraryStore,
    processor,
    libraryPath,
  ).execute();
}

async function withLibrary(
  run: (context: {
    libraryPath: string;
    libraryStore: ReturnType<typeof openSqliteLibraryStore>;
    processor: FakeVideoProcessor;
  }) => Promise<void>,
): Promise<void> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-ensure-"));
  await mkdir(join(libraryPath, ".ts"));
  const libraryStore = openSqliteLibraryStore(":memory:");
  const processor = new FakeVideoProcessor();

  try {
    await run({ libraryPath, libraryStore, processor });
  } finally {
    libraryStore.close();
    await rm(libraryPath, { recursive: true, force: true });
  }
}

async function writeLibraryVideo(libraryPath: string, videoId: string): Promise<void> {
  const videoPath = join(libraryPath, videoId);
  await mkdir(dirname(videoPath), { recursive: true });
  await writeFile(videoPath, "fake-video");
}

class FakeVideoProcessor implements VideoProcessor {
  probeCount = 0;
  thumbnailOutputs: string[] = [];
  private readonly recordingTimes = new Map<string, string | null>();
  private readonly failures = new Set<string>();

  setRecordingTime(videoId: string, recordingTime: string | null): void {
    this.recordingTimes.set(videoId, recordingTime);
  }

  fail(videoId: string): void {
    this.failures.add(videoId);
  }

  async probe(inputPath: string): Promise<VideoProbeResult> {
    const videoId = inputPath.split(/[/\\]/).at(-1) ?? inputPath;
    this.probeCount += 1;

    if (this.failures.has(videoId)) {
      throw new Error(`ffprobe failed for ${videoId}`);
    }

    return {
      durationSeconds: 1,
      width: 320,
      height: 240,
      videoCodec: "h264",
      audioCodec: "aac",
      recordingTime: this.recordingTimes.get(videoId) ?? null,
    };
  }

  async convert(_inputPath: string, _outputPath: string, _options?: VideoConvertOptions): Promise<void> {
    throw new Error("convert must not run during ensure");
  }

  async generateThumbnail(_inputPath: string, outputPath: string): Promise<void> {
    this.thumbnailOutputs.push(outputPath);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, "generated-thumb");
  }
}

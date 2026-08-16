import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { BackfillRecordedAtUseCase } from "../src/application/backfill-recorded-at.js";
import { toStoredRecordedAt } from "../src/application/resolve-canonical-upload-name.js";
import { recordedAtFromFileName } from "../src/application/filename-recorded-at-fallback.js";
import type { VideoConvertOptions, VideoProbeResult, VideoProcessor } from "../src/ports/video-processor.js";

const RECORDING_TIME = "2026-03-14T19:04:31.123Z";

test("backfill dry-run reports detected dates without writing SQLite", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("clip.mp4");
    await writeLibraryVideo(libraryPath, "clip.mp4");
    processor.setRecordingTime("clip.mp4", RECORDING_TIME);

    const useCase = new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath);
    const result = await useCase.execute({ dryRun: true });

    assert.equal(result.processed, 1);
    assert.equal(result.detected, 1);
    assert.equal(result.updated, 1);
    assert.equal(result.withoutDate, 0);
    assert.deepEqual(result.previews, [
      {
        videoId: "clip.mp4",
        source: "ffprobe",
        current: null,
        detected: toStoredRecordedAt(RECORDING_TIME),
      },
    ]);
    assert.equal(libraryStore.findVideo("clip.mp4")?.recordedAt, null);
  });
});

test("backfill writes detected dates and is idempotent", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("clip.mp4");
    await writeLibraryVideo(libraryPath, "clip.mp4");
    processor.setRecordingTime("clip.mp4", RECORDING_TIME);

    const useCase = new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath);
    const first = await useCase.execute({ dryRun: false });
    const stored = toStoredRecordedAt(RECORDING_TIME);

    assert.equal(first.updated, 1);
    assert.equal(libraryStore.findVideo("clip.mp4")?.recordedAt, stored);

    const second = await useCase.execute({ dryRun: false });
    assert.equal(second.detected, 1);
    assert.equal(second.updated, 0);
    assert.equal(libraryStore.findVideo("clip.mp4")?.recordedAt, stored);
  });
});

test("backfill leaves recorded_at NULL when metadata has no reliable date", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("clip.mp4");
    await writeLibraryVideo(libraryPath, "clip.mp4");
    processor.setRecordingTime("clip.mp4", "1970-01-01T00:00:00.000000Z");

    const result = await new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath).execute({
      dryRun: false,
    });

    assert.equal(result.withoutDate, 1);
    assert.equal(result.updated, 0);
    assert.equal(result.previews[0]?.source, "none");
    assert.equal(libraryStore.findVideo("clip.mp4")?.recordedAt, null);
  });
});

test("backfill continues after a probe error", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("bad.mp4");
    libraryStore.upsertVideo("good.mp4");
    await writeLibraryVideo(libraryPath, "bad.mp4");
    await writeLibraryVideo(libraryPath, "good.mp4");
    processor.fail("bad.mp4");
    processor.setRecordingTime("good.mp4", RECORDING_TIME);

    const result = await new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath).execute({
      dryRun: false,
    });

    assert.equal(result.processed, 2);
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0]?.videoId, "bad.mp4");
    assert.equal(result.detected, 1);
    assert.equal(result.updated, 1);
    assert.equal(libraryStore.findVideo("bad.mp4")?.recordedAt, null);
    assert.equal(libraryStore.findVideo("good.mp4")?.recordedAt, toStoredRecordedAt(RECORDING_TIME));
  });
});

test("backfill prefers ffprobe over a filename fallback", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("VID-20251227-WA0005.mp4");
    await writeLibraryVideo(libraryPath, "VID-20251227-WA0005.mp4");
    processor.setRecordingTime("VID-20251227-WA0005.mp4", RECORDING_TIME);

    const result = await new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath).execute({
      dryRun: false,
    });

    assert.equal(result.previews[0]?.source, "ffprobe");
    assert.equal(result.previews[0]?.detected, toStoredRecordedAt(RECORDING_TIME));
    assert.equal(libraryStore.findVideo("VID-20251227-WA0005.mp4")?.recordedAt, toStoredRecordedAt(RECORDING_TIME));
    assert.notEqual(result.previews[0]?.detected, recordedAtFromFileName("VID-20251227-WA0005.mp4"));
  });
});

test("backfill dry-run reports filename fallback without writing SQLite", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("20241016-WA0010-mariposas.mp4");
    await writeLibraryVideo(libraryPath, "20241016-WA0010-mariposas.mp4");

    const detected = recordedAtFromFileName("20241016-WA0010-mariposas.mp4");
    const result = await new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath).execute({
      dryRun: true,
    });

    assert.equal(detected, "2024-10-16T18:00:00.000Z");
    assert.deepEqual(result.previews, [
      {
        videoId: "20241016-WA0010-mariposas.mp4",
        source: "filename-fallback",
        current: null,
        detected,
      },
    ]);
    assert.equal(result.updated, 1);
    assert.equal(libraryStore.findVideo("20241016-WA0010-mariposas.mp4")?.recordedAt, null);
  });
});

test("backfill writes filename fallback and is idempotent", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("VID-20251227-WA0005.mp4");
    await writeLibraryVideo(libraryPath, "VID-20251227-WA0005.mp4");

    const useCase = new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath);
    const first = await useCase.execute({ dryRun: false });
    const stored = recordedAtFromFileName("VID-20251227-WA0005.mp4");

    assert.equal(first.previews[0]?.source, "filename-fallback");
    assert.equal(first.updated, 1);
    assert.equal(libraryStore.findVideo("VID-20251227-WA0005.mp4")?.recordedAt, stored);

    const second = await useCase.execute({ dryRun: false });
    assert.equal(second.detected, 1);
    assert.equal(second.updated, 0);
    assert.equal(libraryStore.findVideo("VID-20251227-WA0005.mp4")?.recordedAt, stored);
  });
});

test("backfill does not invent a date for unmatched names without ffprobe metadata", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("otro-video.mp4");
    await writeLibraryVideo(libraryPath, "otro-video.mp4");

    const result = await new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath).execute({
      dryRun: false,
    });

    assert.equal(result.previews[0]?.source, "none");
    assert.equal(result.previews[0]?.detected, null);
    assert.equal(libraryStore.findVideo("otro-video.mp4")?.recordedAt, null);
  });
});

test("backfill leaves NULL when a filename date is not a valid calendar day", async () => {
  await withLibrary(async ({ libraryPath, libraryStore, processor }) => {
    libraryStore.upsertVideo("VID-20250230-WA0001.mp4");
    await writeLibraryVideo(libraryPath, "VID-20250230-WA0001.mp4");

    const result = await new BackfillRecordedAtUseCase(libraryStore, processor, libraryPath).execute({
      dryRun: false,
    });

    assert.equal(result.previews[0]?.source, "none");
    assert.equal(result.previews[0]?.detected, null);
    assert.equal(libraryStore.findVideo("VID-20250230-WA0001.mp4")?.recordedAt, null);
  });
});

async function withLibrary(
  run: (context: {
    libraryPath: string;
    libraryStore: ReturnType<typeof openSqliteLibraryStore>;
    processor: FakeVideoProcessor;
  }) => Promise<void>,
): Promise<void> {
  const libraryPath = await mkdtemp(join(tmpdir(), "media-library-backfill-"));
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
    throw new Error("convert must not run during backfill");
  }

  async generateThumbnail(_inputPath: string, _outputPath: string): Promise<void> {
    throw new Error("thumbnail must not run during backfill");
  }
}

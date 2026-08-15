import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryProcessingJobStore } from "../src/adapters/in-memory-processing-job-store.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { InstallProcessedUploadUseCase } from "../src/application/install-processed-upload.js";
import {
  createProcessingJob,
  transitionProcessingJob,
  type ProcessingJob,
} from "../src/application/processing-job.js";
import type { ProcessedVideoJob } from "../src/application/process-video-job.js";
import { VideoAlreadyExistsError } from "../src/application/video-already-exists-error.js";
import type { LibraryMediaInstaller, LibraryMediaPresence } from "../src/ports/library-media-installer.js";
import type { LibraryStore } from "../src/ports/library-store.js";

const libraryPath = "/library";

test("installs processed video and thumbnail, then registers SQLite without tags", async () => {
  const { useCase, installer, libraryStore, jobs } = createHarness();
  const processed = stagedJob(jobs, "clip.mp4", "job-ok");

  const result = await useCase.execute(processed);

  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }

  assert.equal(result.installed, true);
  assert.equal(result.videoId, "clip.mp4");
  assert.equal(installer.installedVideo, "clip.mp4");
  assert.equal(installer.installedThumbnail, "clip.mp4");
  assert.equal(libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
  assert.deepEqual(libraryStore.getVideoTags("clip.mp4"), []);
  assert.deepEqual(result.job.state, { status: "completed", videoId: "clip.mp4" });
});

test("rejects a video id that already exists in SQLite", async () => {
  const { useCase, installer, libraryStore, jobs } = createHarness();
  libraryStore.upsertVideo("clip.mp4");
  const processed = stagedJob(jobs, "clip.mp4", "job-dup-db");

  await assert.rejects(() => useCase.assertAvailable("clip.mp4"), (error: unknown) => {
    assert.ok(error instanceof VideoAlreadyExistsError);
    return true;
  });

  const result = await useCase.execute(processed);
  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.equal(result.conflict, true);
  assert.equal(installer.installedVideo, null);
  assert.equal(libraryStore.listVideos().length, 1);
});

test("rejects a destination that already exists on the filesystem", async () => {
  const { useCase, installer, libraryStore, jobs } = createHarness();
  installer.presence = { video: true, thumbnail: false };
  const processed = stagedJob(jobs, "clip.mp4", "job-dup-fs");

  const result = await useCase.execute(processed);
  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.equal(result.conflict, true);
  assert.equal(installer.installedVideo, null);
  assert.equal(libraryStore.findVideo("clip.mp4"), null);
});

test("removes a newly copied video when thumbnail install fails", async () => {
  const { useCase, installer, libraryStore, jobs } = createHarness();
  installer.failAt = "thumbnail";
  const processed = stagedJob(jobs, "clip.mp4", "job-thumb");

  const result = await useCase.execute(processed);
  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.equal(result.conflict, false);
  assert.equal(installer.removedVideo, true);
  assert.equal(installer.presence.video, false);
  assert.equal(libraryStore.findVideo("clip.mp4"), null);
  assert.equal(result.job.state.status, "failed");
});

test("does not leave a partial video when video install fails", async () => {
  const { useCase, installer, libraryStore, jobs } = createHarness();
  installer.failAt = "video";
  const processed = stagedJob(jobs, "clip.mp4", "job-video");

  const result = await useCase.execute(processed);
  assert.equal(result.status, "failed");
  assert.equal(installer.installedVideo, null);
  assert.equal(installer.removedVideo, false);
  assert.equal(libraryStore.findVideo("clip.mp4"), null);
});

test("compensates installed files when SQLite upsert fails", async () => {
  const { useCase, installer, libraryStore, jobs, failUpsert } = createHarness();
  failUpsert.current = true;
  const processed = stagedJob(jobs, "clip.mp4", "job-sqlite");

  const result = await useCase.execute(processed);
  assert.equal(result.status, "failed");
  assert.equal(installer.removedVideo, true);
  assert.equal(installer.removedThumbnail, true);
  assert.equal(installer.presence.video, false);
  assert.equal(installer.presence.thumbnail, false);
  failUpsert.current = false;
  assert.equal(libraryStore.findVideo("clip.mp4"), null);
});

test("keeps pre-existing files when compensation would otherwise run", async () => {
  const { useCase, installer, jobs } = createHarness();
  installer.presence = { video: true, thumbnail: true };
  const processed = stagedJob(jobs, "keep.mp4", "job-keep");

  const result = await useCase.execute(processed);
  assert.equal(result.status, "failed");
  assert.equal(result.conflict, true);
  assert.equal(installer.removedVideo, false);
  assert.equal(installer.removedThumbnail, false);
  assert.deepEqual(installer.presence, { video: true, thumbnail: true });
});

function stagedJob(jobs: InMemoryProcessingJobStore, originalName: string, jobId: string): ProcessedVideoJob {
  let job: ProcessingJob = createProcessingJob({ originalName, id: jobId });
  job = transitionProcessingJob(job, { status: "uploading" });
  job = transitionProcessingJob(job, { status: "processing", phase: "processing" });
  job = transitionProcessingJob(job, { status: "processing", phase: "generating_thumbnail" });
  job = transitionProcessingJob(job, { status: "processing", phase: "finalizing" });
  job = { ...job, converted: true };
  jobs.create(job);

  return {
    jobId,
    originalName,
    converted: true,
    probe: {
      durationSeconds: 1,
      width: 320,
      height: 240,
      videoCodec: "hevc",
      audioCodec: "aac",
    },
    outputVideoPath: "/tmp/source-or-converted",
    thumbnailPath: "/tmp/thumbnail.jpg",
    workspaceDirectory: "/tmp/job",
    job,
  };
}

function createHarness(): {
  useCase: InstallProcessedUploadUseCase;
  installer: FakeLibraryMediaInstaller;
  libraryStore: LibraryStore;
  jobs: InMemoryProcessingJobStore;
  failUpsert: { current: boolean };
} {
  const inner = openSqliteLibraryStore(":memory:");
  const failUpsert = { current: false };
  const libraryStore = wrapLibraryStore(inner, failUpsert);
  const installer = new FakeLibraryMediaInstaller();
  const jobs = new InMemoryProcessingJobStore();
  const useCase = new InstallProcessedUploadUseCase(
    installer,
    libraryStore,
    new InMemoryVideoIndex([]),
    jobs,
    libraryPath,
  );

  return { useCase, installer, libraryStore, jobs, failUpsert };
}

function wrapLibraryStore(inner: LibraryStore, failUpsert: { current: boolean }): LibraryStore {
  return new Proxy(inner, {
    get(target, property, receiver) {
      if (property === "upsertVideo") {
        return (id: string) => {
          if (failUpsert.current) {
            throw new Error("sqlite down");
          }

          return target.upsertVideo(id);
        };
      }

      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

class FakeLibraryMediaInstaller implements LibraryMediaInstaller {
  presence: LibraryMediaPresence = { video: false, thumbnail: false };
  installedVideo: string | null = null;
  installedThumbnail: string | null = null;
  removedVideo = false;
  removedThumbnail = false;
  failAt?: "video" | "thumbnail";

  async exists(_videoId: string): Promise<LibraryMediaPresence> {
    return this.presence;
  }

  async installVideo(_sourcePath: string, videoId: string): Promise<void> {
    if (this.failAt === "video") {
      throw new Error("video copy failed");
    }

    this.installedVideo = videoId;
    this.presence = { ...this.presence, video: true };
  }

  async installThumbnail(_sourcePath: string, videoId: string): Promise<void> {
    if (this.failAt === "thumbnail") {
      throw new Error("thumbnail copy failed");
    }

    this.installedThumbnail = videoId;
    this.presence = { ...this.presence, thumbnail: true };
  }

  async removeVideo(_videoId: string): Promise<void> {
    this.removedVideo = true;
    this.presence = { ...this.presence, video: false };
  }

  async removeThumbnail(_videoId: string): Promise<void> {
    this.removedThumbnail = true;
    this.presence = { ...this.presence, thumbnail: false };
  }
}

import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FilesystemLibraryMediaInstaller } from "../src/adapters/filesystem/filesystem-library-media-installer.js";
import { FilesystemProcessingWorkspace } from "../src/adapters/filesystem/filesystem-processing-workspace.js";
import { InMemoryProcessingJobStore } from "../src/adapters/in-memory-processing-job-store.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { WorkspaceVideoDiscovery } from "../src/adapters/indexer/workspace-video-discovery.js";
import { SqliteLibraryIndexer } from "../src/adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { createApp } from "../src/app.js";
import { createProcessingJob, isTerminalProcessingJob, transitionProcessingJob } from "../src/application/processing-job.js";
import { ProcessVideoJobUseCase } from "../src/application/process-video-job.js";
import { RefreshLibraryUseCase } from "../src/application/refresh-library.js";
import { SyncNewVideosUseCase } from "../src/application/sync-new-videos.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { PUBLIC_PROCESSING_FAILED_MESSAGE } from "../src/application/to-upload-job-view.js";
import { PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE } from "../src/application/video-already-exists-error.js";
import type { LibraryMediaInstaller } from "../src/ports/library-media-installer.js";
import type { LibraryStore } from "../src/ports/library-store.js";
import type { ProcessingJob, ProcessingPhase } from "../src/ports/processing-job-store.js";
import type { VideoProbeResult, VideoProcessor } from "../src/ports/video-processor.js";

const VIDEO_BYTES = Buffer.from("fake-video-bytes");
const THUMBNAIL_BYTES = Buffer.from([0xff, 0xd8, 0xff]);

test("POST /api/admin/uploads returns 202 and finishes HEVC install asynchronously", async () => {
  await withUploadApp({ codec: "hevc" }, async (context) => {
    const clientPath = join(context.clientDir, "PXL_clip.mp4");
    await writeFile(clientPath, VIDEO_BYTES);
    const beforeClient = await stat(clientPath);
    const tagsBefore = context.libraryStore.listTags().length;
    const relationsBefore = relationCount(context.libraryStore);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("PXL_clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const body = response.json() as Record<string, unknown>;
    assert.equal(typeof body.jobId, "string");
    assert.equal(body.status, "uploading");
    assert.equal(body.installed, undefined);
    assert.equal(JSON.stringify(body).includes(context.uploadTempPath.replaceAll("\\", "\\\\")), false);
    assert.equal(JSON.stringify(body).includes(context.libraryPath.replaceAll("\\", "\\\\")), false);

    const jobId = String(body.jobId);
    const immediate = await context.app.inject({
      method: "GET",
      url: `/api/admin/uploads/${jobId}`,
    });
    assert.equal(immediate.statusCode, 200);
    assert.ok(["uploading", "processing", "completed"].includes(String(immediate.json().status)));

    const job = await waitForTerminalJob(context.jobs, jobId);
    assert.equal(job.state.status, "completed");

    const names = await readdir(join(context.uploadTempPath, jobId));
    assert.ok(names.includes("source"));
    assert.ok(names.includes("converted.mp4"));
    assert.ok(names.includes("thumbnail.jpg"));

    assert.equal(await readFile(join(context.libraryPath, "PXL_clip.mp4"), "utf8"), VIDEO_BYTES.toString());
    assert.deepEqual(await readFile(join(context.libraryPath, ".ts", "PXL_clip.mp4.jpg")), THUMBNAIL_BYTES);

    const afterClient = await stat(clientPath);
    assert.equal(afterClient.size, beforeClient.size);
    assert.equal(afterClient.mtimeMs, beforeClient.mtimeMs);
    assert.equal(context.processor.convertCalls, 1);

    const recorded = context.libraryStore.findVideo("PXL_clip.mp4");
    assert.equal(recorded?.id, "PXL_clip.mp4");
    assert.deepEqual(context.libraryStore.getVideoTags("PXL_clip.mp4"), []);
    assert.equal(context.libraryStore.listTags().length, tagsBefore);
    assert.equal(relationCount(context.libraryStore), relationsBefore);

    const search = await context.app.inject({ method: "GET", url: "/api/search" });
    assert.equal(search.statusCode, 200);
    const uploaded = search.json().results.find((item: { id: string }) => item.id === "PXL_clip.mp4");
    assert.deepEqual(uploaded, {
      id: "PXL_clip.mp4",
      name: "PXL_clip.mp4",
      thumbnail: "/api/thumbnail/PXL_clip.mp4",
      video: "/api/video/PXL_clip.mp4",
      tags: [],
    });

    const tagged = await context.app.inject({ method: "GET", url: "/api/search?tag=salsa" });
    assert.equal(tagged.json().results.some((item: { id: string }) => item.id === "PXL_clip.mp4"), false);

    const video = await context.app.inject({ method: "GET", url: "/api/video/PXL_clip.mp4" });
    assert.equal(video.statusCode, 200);
    assert.equal(video.rawPayload.equals(VIDEO_BYTES), true);

    const thumbnail = await context.app.inject({ method: "GET", url: "/api/thumbnail/PXL_clip.mp4" });
    assert.equal(thumbnail.statusCode, 200);
    assert.equal(thumbnail.headers["content-type"], "image/jpeg");
    assert.deepEqual(thumbnail.rawPayload, THUMBNAIL_BYTES);

    const status = await context.app.inject({
      method: "GET",
      url: `/api/admin/uploads/${jobId}`,
    });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().status, "completed");
    assert.equal(status.json().phase, "completed");
    assert.equal(status.json().converted, true);
    assert.equal(status.json().videoId, "PXL_clip.mp4");
    assert.equal(JSON.stringify(status.json()).includes(context.libraryPath.replaceAll("\\", "\\\\")), false);
  });
});

test("POST /api/admin/uploads does not wait for processing when the pipeline is gated", async () => {
  await withUploadApp({ codec: "h264", holdProcessing: true }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const jobId = String(response.json().jobId);
    assert.notEqual(context.jobs.findById(jobId)?.state.status, "completed");
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);

    const status = await context.app.inject({
      method: "GET",
      url: `/api/admin/uploads/${jobId}`,
    });
    assert.equal(status.statusCode, 200);
    assert.ok(["uploading", "processing"].includes(String(status.json().status)));

    context.processor.release();
    const job = await waitForTerminalJob(context.jobs, jobId);
    assert.equal(job.state.status, "completed");
    assert.equal(context.libraryStore.findVideo("clip.mp4")?.id, "clip.mp4");
  });
});

test("POST /api/admin/uploads installs an H.264 video without conversion", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const jobId = String(response.json().jobId);
    const job = await waitForTerminalJob(context.jobs, jobId);
    assert.equal(job.state.status, "completed");
    assert.equal(job.converted, false);
    assert.equal(context.processor.convertCalls, 0);

    const names = await readdir(join(context.uploadTempPath, jobId));
    assert.ok(names.includes("source"));
    assert.ok(names.includes("thumbnail.jpg"));
    assert.equal(names.includes("converted.mp4"), false);

    assert.equal(await readFile(join(context.libraryPath, "clip.mp4"), "utf8"), VIDEO_BYTES.toString());
    assert.ok(await readFile(join(context.libraryPath, ".ts", "clip.mp4.jpg")));
    assert.deepEqual(context.libraryStore.getVideoTags("clip.mp4"), []);
  });
});

test("POST /api/admin/uploads rejects a missing file", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      payload: { hello: "world" },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error.message, "A video file is required.");
  });
});

test("POST /api/admin/uploads rejects an oversized file", async () => {
  await withUploadApp({ codec: "h264", uploadMaxBytes: 32 }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", Buffer.alloc(64, 1)),
    });

    assert.equal(response.statusCode, 413);
    assert.equal(response.json().error.message, "The uploaded video exceeds the size limit.");
  });
});

test("POST /api/admin/uploads rejects path traversal file names", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const traversal = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("..archivo.mp4", VIDEO_BYTES),
    });

    assert.equal(traversal.statusCode, 400);
    assert.match(traversal.json().error.message, /invalid|not supported/i);

    const nested = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("../../archivo.mp4", VIDEO_BYTES),
    });

    if (nested.statusCode === 202) {
      assert.equal(nested.json().status, "uploading");
      const jobId = String(nested.json().jobId);
      const job = await waitForTerminalJob(context.jobs, jobId);
      assert.equal(job.state.status, "completed");
      assert.equal(job.originalName, "archivo.mp4");
      const jobDir = join(context.uploadTempPath, jobId);
      assert.equal(jobDir.startsWith(context.uploadTempPath), true);
      assert.equal(await readFile(join(context.libraryPath, "archivo.mp4"), "utf8"), VIDEO_BYTES.toString());
    } else {
      assert.equal(nested.statusCode, 400);
    }

    assert.equal((await readdir(context.libraryPath)).includes(".."), false);
  });
});

test("POST /api/admin/uploads rejects a second active job", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    context.jobs.create(
      transitionProcessingJob(createProcessingJob({ originalName: "busy.mp4", id: "busy" }), {
        status: "uploading",
      }),
    );

    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.message, "A video processing job is already active.");
    assert.equal(response.json().jobId, "busy");
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
  });
});

test("POST /api/admin/uploads returns 409 while a gated job is still active", async () => {
  await withUploadApp({ codec: "h264", holdProcessing: true }, async (context) => {
    const first = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("one.mp4", VIDEO_BYTES),
    });
    assert.equal(first.statusCode, 202);
    const firstJobId = String(first.json().jobId);

    const second = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("two.mp4", VIDEO_BYTES),
    });
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().error.message, "A video processing job is already active.");
    assert.equal(second.json().jobId, firstJobId);
    assert.equal(context.libraryStore.findVideo("two.mp4"), null);
    assert.equal((await readdir(context.libraryPath)).includes("two.mp4"), false);

    context.processor.release();
    const job = await waitForTerminalJob(context.jobs, firstJobId);
    assert.equal(job.state.status, "completed");
  });
});

test("POST /api/admin/uploads accepts another file after the previous job completed", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const first = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("one.mp4", VIDEO_BYTES),
    });
    assert.equal(first.statusCode, 202);
    assert.equal((await waitForTerminalJob(context.jobs, String(first.json().jobId))).state.status, "completed");

    const second = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("two.mp4", VIDEO_BYTES),
    });
    assert.equal(second.statusCode, 202);
    assert.equal((await waitForTerminalJob(context.jobs, String(second.json().jobId))).state.status, "completed");
    assert.equal(context.libraryStore.findVideo("one.mp4")?.id, "one.mp4");
    assert.equal(context.libraryStore.findVideo("two.mp4")?.id, "two.mp4");
  });
});

test("GET /api/admin/uploads/:jobId returns 404 for an unknown job", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const response = await context.app.inject({
      method: "GET",
      url: "/api/admin/uploads/missing-job",
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.message, "Upload job not found");
  });
});

test("GET /api/admin/uploads/active returns 404 when no job is active", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const response = await context.app.inject({
      method: "GET",
      url: "/api/admin/uploads/active",
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error.message, "No active upload job.");
  });
});

test("GET /api/admin/uploads/active returns uploading, processing, and installing jobs", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    seedJob(context.jobs, { id: "uploading-job", originalName: "one.mp4", status: "uploading" });
    const uploading = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(uploading.statusCode, 200);
    assert.equal(uploading.json().jobId, "uploading-job");
    assert.equal(uploading.json().status, "uploading");
    assert.equal(uploading.json().phase, "uploading");
    assert.equal(uploading.json().videoId, "one.mp4");
    assert.equal(uploading.json().progress, null);
  });

  await withUploadApp({ codec: "h264" }, async (context) => {
    seedJob(context.jobs, {
      id: "processing-job",
      originalName: "two.mp4",
      status: "processing",
      phase: "processing",
      converted: true,
      progress: 47,
    });
    const processing = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(processing.statusCode, 200);
    assert.equal(processing.json().jobId, "processing-job");
    assert.equal(processing.json().status, "processing");
    assert.equal(processing.json().phase, "processing");
    assert.equal(processing.json().progress, 47);
    const byId = await context.app.inject({ method: "GET", url: "/api/admin/uploads/processing-job" });
    assert.equal(byId.json().progress, 47);
  });

  await withUploadApp({ codec: "h264" }, async (context) => {
    seedJob(context.jobs, {
      id: "installing-job",
      originalName: "three.mp4",
      status: "processing",
      phase: "installing",
      converted: true,
      progress: 100,
    });
    const installing = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(installing.statusCode, 200);
    assert.equal(installing.json().jobId, "installing-job");
    assert.equal(installing.json().phase, "installing");
    assert.equal(installing.json().progress, 100);
  });
});

test("GET /api/admin/uploads/active ignores completed and failed jobs", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    seedJob(context.jobs, { id: "done", originalName: "done.mp4", status: "completed", converted: false });
    const completed = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(completed.statusCode, 404);
  });

  await withUploadApp({ codec: "h264" }, async (context) => {
    seedJob(context.jobs, { id: "failed", originalName: "failed.mp4", status: "failed" });
    const failed = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(failed.statusCode, 404);
  });
});

test("upload job status endpoints expose conversion progress including clamped values", async () => {
  await withUploadApp({ codec: "hevc" }, async (context) => {
    seedJob(context.jobs, {
      id: "progress-0",
      originalName: "clip.mp4",
      status: "processing",
      phase: "processing",
      converted: true,
      progress: 0,
    });
    const zero = await context.app.inject({ method: "GET", url: "/api/admin/uploads/progress-0" });
    assert.equal(zero.json().progress, 0);

    context.jobs.update({
      ...context.jobs.findById("progress-0")!,
      progress: 150,
    });
    const clamped = await context.app.inject({ method: "GET", url: "/api/admin/uploads/progress-0" });
    assert.equal(clamped.json().progress, 100);
    const active = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(active.json().progress, 100);
    assert.equal(active.json().jobId, "progress-0");
  });
});

test("H.264 jobs do not expose conversion progress", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    seedJob(context.jobs, {
      id: "h264-job",
      originalName: "h264.mp4",
      status: "processing",
      phase: "processing",
      converted: false,
      progress: null,
    });

    const status = await context.app.inject({ method: "GET", url: "/api/admin/uploads/h264-job" });
    const active = await context.app.inject({ method: "GET", url: "/api/admin/uploads/active" });
    assert.equal(status.json().converted, false);
    assert.equal(status.json().progress, null);
    assert.equal(active.statusCode, 200);
    assert.equal(active.json().progress, null);
  });
});

test("failed processing is visible on GET without exposing internal paths", async () => {
  await withUploadApp({ codec: "hevc", failAt: "probe" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const jobId = String(response.json().jobId);
    const job = await waitForTerminalJob(context.jobs, jobId);
    assert.equal(job.state.status, "failed");

    const status = await context.app.inject({
      method: "GET",
      url: `/api/admin/uploads/${jobId}`,
    });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().status, "failed");
    assert.equal(status.json().error.message, PUBLIC_PROCESSING_FAILED_MESSAGE);
    assert.equal(JSON.stringify(status.json()).includes("C:\\secret"), false);
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
    assert.equal((await readdir(context.libraryPath)).includes("clip.mp4"), false);
  });
});

test("POST /api/admin/uploads rejects a duplicate video without overwriting", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const first = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });
    assert.equal(first.statusCode, 202);
    assert.equal((await waitForTerminalJob(context.jobs, String(first.json().jobId))).state.status, "completed");

    const original = await readFile(join(context.libraryPath, "clip.mp4"));
    const originalThumb = await readFile(join(context.libraryPath, ".ts", "clip.mp4.jpg"));
    const videosBefore = context.libraryStore.listVideos().length;

    const second = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", Buffer.from("replacement-bytes")),
    });

    assert.equal(second.statusCode, 409);
    assert.equal(second.json().error.message, PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE);
    assert.equal(second.json().jobId, undefined);
    assert.deepEqual(await readFile(join(context.libraryPath, "clip.mp4")), original);
    assert.deepEqual(await readFile(join(context.libraryPath, ".ts", "clip.mp4.jpg")), originalThumb);
    assert.equal(context.libraryStore.listVideos().length, videosBefore);
    assert.deepEqual(context.libraryStore.getVideoTags("clip.mp4"), []);
  });
});

test("POST /api/admin/uploads rejects a filesystem video that is not in SQLite", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    await writeFile(join(context.libraryPath, "orphan.mp4"), "keep-me");
    const videosBefore = context.libraryStore.listVideos().map((video) => video.id);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("orphan.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.json().error.message, PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE);
    assert.equal(await readFile(join(context.libraryPath, "orphan.mp4"), "utf8"), "keep-me");
    assert.deepEqual(context.libraryStore.listVideos().map((video) => video.id), videosBefore);
    assert.equal(context.libraryStore.findVideo("orphan.mp4"), null);
  });
});

test("POST /api/admin/uploads cleans up a partial video when thumbnail install fails", async () => {
  await withUploadApp({ codec: "h264", failInstallAt: "thumbnail" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const jobId = String(response.json().jobId);
    const job = await waitForTerminalJob(context.jobs, jobId);
    assert.equal(job.state.status, "failed");
    assert.equal((await readdir(context.libraryPath)).includes("clip.mp4"), false);
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
    assert.ok((await readdir(join(context.uploadTempPath, jobId))).includes("source"));

    const status = await context.app.inject({
      method: "GET",
      url: `/api/admin/uploads/${jobId}`,
    });
    assert.equal(status.json().status, "failed");
    assert.equal(status.json().error.message, PUBLIC_PROCESSING_FAILED_MESSAGE);
  });
});

test("POST /api/admin/uploads does not leave a library video when video install fails", async () => {
  await withUploadApp({ codec: "h264", failInstallAt: "video" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const job = await waitForTerminalJob(context.jobs, String(response.json().jobId));
    assert.equal(job.state.status, "failed");
    assert.equal((await readdir(context.libraryPath)).includes("clip.mp4"), false);
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
  });
});

test("POST /api/admin/uploads compensates files when SQLite fails after install", async () => {
  await withUploadApp({ codec: "h264", failSqlite: true }, async (context) => {
    await writeFile(join(context.libraryPath, "keep.mp4"), "preexisting");
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 202);
    const job = await waitForTerminalJob(context.jobs, String(response.json().jobId));
    assert.equal(job.state.status, "failed");
    assert.equal((await readdir(context.libraryPath)).includes("clip.mp4"), false);
    assert.equal(await readFile(join(context.libraryPath, "keep.mp4"), "utf8"), "preexisting");
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
  });
});

test("POST /api/library/refresh after upload does not duplicate the video or add tags", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const upload = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });
    assert.equal(upload.statusCode, 202);
    assert.equal((await waitForTerminalJob(context.jobs, String(upload.json().jobId))).state.status, "completed");

    const refresh = await context.app.inject({
      method: "POST",
      url: "/api/library/refresh",
    });
    assert.equal(refresh.statusCode, 200);

    const matches = context.libraryStore.listVideosWithTags().filter((video) => video.id === "clip.mp4");
    assert.equal(matches.length, 1);
    assert.deepEqual(matches[0]?.tags, []);

    const search = await context.app.inject({ method: "GET", url: "/api/search" });
    assert.equal(search.json().results.filter((item: { id: string }) => item.id === "clip.mp4").length, 1);
  });
});

async function withUploadApp(
  options: {
    codec: string;
    failAt?: "probe" | "convert" | "thumbnail";
    failInstallAt?: "video" | "thumbnail";
    failSqlite?: boolean;
    holdProcessing?: boolean;
    uploadMaxBytes?: number;
  },
  run: (context: {
    app: Awaited<ReturnType<typeof createApp>>;
    processor: RecordingVideoProcessor;
    jobs: InMemoryProcessingJobStore;
    libraryStore: LibraryStore;
    libraryPath: string;
    uploadTempPath: string;
    clientDir: string;
  }) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "media-library-upload-"));
  const libraryPath = join(root, "library");
  const uploadTempPath = join(root, "upload-temp");
  const clientDir = join(root, "client");
  await mkdir(libraryPath);
  await mkdir(uploadTempPath);
  await mkdir(clientDir);

  const failUpsert = { current: false };
  const innerStore = openSqliteLibraryStore(":memory:");
  const libraryStore = wrapLibraryStore(innerStore, failUpsert);
  libraryStore.upsertVideo("existing.mp4");
  failUpsert.current = options.failSqlite === true;
  const jobs = new InMemoryProcessingJobStore();
  const processor = new RecordingVideoProcessor(options.codec, options.failAt);
  if (options.holdProcessing === true) {
    processor.hold();
  }
  const videoIndex = new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));
  const installer: LibraryMediaInstaller = new FailingLibraryMediaInstaller(
    new FilesystemLibraryMediaInstaller(libraryPath),
    options.failInstallAt,
  );
  const app = await createApp({
    videoIndex,
    libraryPath,
    libraryStore,
    libraryMediaInstaller: installer,
    refreshLibraryUseCase: new RefreshLibraryUseCase(
      new SyncNewVideosUseCase(new WorkspaceVideoDiscovery(libraryPath), libraryStore, libraryPath),
      new SqliteLibraryIndexer(libraryStore, libraryPath),
      videoIndex,
    ),
    processVideoJobUseCase: new ProcessVideoJobUseCase(
      processor,
      new FilesystemProcessingWorkspace(uploadTempPath),
      jobs,
    ),
    processingJobStore: jobs,
    backgroundUploadErrorLogger: () => undefined,
    uploadMaxBytes: options.uploadMaxBytes ?? 1024 * 1024,
  });

  const rejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onUnhandledRejection);

  try {
    await run({ app, processor, jobs, libraryStore, libraryPath, uploadTempPath, clientDir });
    assert.equal(rejections.length, 0, `Unhandled rejections: ${String(rejections[0])}`);
  } finally {
    process.off("unhandledRejection", onUnhandledRejection);
    processor.release();
    await app.close();
    innerStore.close();
    await rm(root, { recursive: true, force: true });
  }
}

async function waitForTerminalJob(jobs: InMemoryProcessingJobStore, jobId: string): Promise<ProcessingJob> {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const job = jobs.findById(jobId);

    if (job !== null && isTerminalProcessingJob(job)) {
      return job;
    }

    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  throw new Error(`Timed out waiting for job ${jobId} to finish`);
}

function seedJob(
  jobs: InMemoryProcessingJobStore,
  options: {
    id: string;
    originalName: string;
    status: "uploading" | "processing" | "completed" | "failed";
    phase?: ProcessingPhase;
    progress?: number | null;
    converted?: boolean | null;
  },
): ProcessingJob {
  let job = createProcessingJob({ originalName: options.originalName, id: options.id });
  jobs.create(job);
  job = transitionProcessingJob(job, { status: "uploading" });

  if (options.status !== "uploading") {
    job = transitionProcessingJob(job, { status: "processing", phase: "processing" });
  }

  if (options.status === "processing" && options.phase !== undefined && options.phase !== "processing") {
    if (options.phase === "generating_thumbnail" || options.phase === "finalizing" || options.phase === "installing") {
      job = transitionProcessingJob(job, { status: "processing", phase: "generating_thumbnail" });
    }

    if (options.phase === "finalizing" || options.phase === "installing") {
      job = transitionProcessingJob(job, { status: "processing", phase: "finalizing" });
    }

    if (options.phase === "installing") {
      job = transitionProcessingJob(job, { status: "processing", phase: "installing" });
    }
  }

  if (options.status === "completed") {
    if (job.state.status === "uploading") {
      job = transitionProcessingJob(job, { status: "processing", phase: "processing" });
    }

    if (job.state.status === "processing" && job.state.phase === "processing") {
      job = transitionProcessingJob(job, { status: "processing", phase: "generating_thumbnail" });
    }

    if (job.state.status === "processing" && job.state.phase === "generating_thumbnail") {
      job = transitionProcessingJob(job, { status: "processing", phase: "finalizing" });
    }

    if (job.state.status === "processing" && job.state.phase === "finalizing") {
      job = transitionProcessingJob(job, { status: "processing", phase: "installing" });
    }

    job = transitionProcessingJob(job, { status: "completed", videoId: options.originalName });
  }

  if (options.status === "failed") {
    job = transitionProcessingJob(job, { status: "failed", error: "failed" });
  }

  job = {
    ...job,
    converted: options.converted ?? null,
    progress: options.progress ?? null,
  };
  jobs.update(job);
  return job;
}

function relationCount(libraryStore: LibraryStore): number {
  return libraryStore.listVideosWithTags().reduce((count, video) => count + video.tags.length, 0);
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

function multipartRequest(filename: string, content: Buffer, field = "video"): {
  headers: { "content-type": string };
  payload: Buffer;
} {
  const boundary = "----mediaLibraryTestBoundary";
  const payload = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: video/mp4\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload,
  };
}

class FailingLibraryMediaInstaller implements LibraryMediaInstaller {
  constructor(
    private readonly inner: LibraryMediaInstaller,
    private readonly failAt?: "video" | "thumbnail",
  ) {}

  exists(videoId: string) {
    return this.inner.exists(videoId);
  }

  async installVideo(sourcePath: string, videoId: string): Promise<void> {
    if (this.failAt === "video") {
      throw new Error("video copy failed");
    }

    await this.inner.installVideo(sourcePath, videoId);
  }

  async installThumbnail(sourcePath: string, videoId: string): Promise<void> {
    if (this.failAt === "thumbnail") {
      throw new Error("thumbnail copy failed");
    }

    await this.inner.installThumbnail(sourcePath, videoId);
  }

  removeVideo(videoId: string) {
    return this.inner.removeVideo(videoId);
  }

  removeThumbnail(videoId: string) {
    return this.inner.removeThumbnail(videoId);
  }
}

class RecordingVideoProcessor implements VideoProcessor {
  convertCalls = 0;
  private gate: Promise<void> = Promise.resolve();
  private resolveGate: (() => void) | undefined;

  constructor(
    private readonly videoCodec: string,
    private readonly failAt?: "probe" | "convert" | "thumbnail",
  ) {}

  hold(): void {
    this.gate = new Promise((resolve) => {
      this.resolveGate = resolve;
    });
  }

  release(): void {
    this.resolveGate?.();
    this.resolveGate = undefined;
    this.gate = Promise.resolve();
  }

  async probe(_inputPath: string): Promise<VideoProbeResult> {
    await this.gate;

    if (this.failAt === "probe") {
      throw new Error(String.raw`probe failed at C:\secret\internal.mp4`);
    }

    return {
      durationSeconds: 2,
      width: 320,
      height: 240,
      videoCodec: this.videoCodec,
      audioCodec: "aac",
    };
  }

  async convert(inputPath: string, outputPath: string): Promise<void> {
    this.convertCalls += 1;
    if (this.failAt === "convert") {
      throw new Error("convert failed");
    }

    await copyFile(inputPath, outputPath);
  }

  async generateThumbnail(_inputPath: string, outputPath: string): Promise<void> {
    if (this.failAt === "thumbnail") {
      throw new Error("thumbnail failed");
    }

    await writeFile(outputPath, THUMBNAIL_BYTES);
  }
}

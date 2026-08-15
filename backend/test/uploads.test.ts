import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { FilesystemProcessingWorkspace } from "../src/adapters/filesystem/filesystem-processing-workspace.js";
import { InMemoryProcessingJobStore } from "../src/adapters/in-memory-processing-job-store.js";
import { InMemoryVideoIndex } from "../src/adapters/in-memory-video-index.js";
import { openSqliteLibraryStore } from "../src/adapters/sqlite/sqlite-library-store.js";
import { createApp } from "../src/app.js";
import { ProcessVideoJobUseCase } from "../src/application/process-video-job.js";
import { createProcessingJob, transitionProcessingJob } from "../src/application/processing-job.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import type { VideoProbeResult, VideoProcessor } from "../src/ports/video-processor.js";

const VIDEO_BYTES = Buffer.from("fake-video-bytes");

test("POST /api/admin/uploads processes an HEVC video through the M3 pipeline", async () => {
  await withUploadApp({ codec: "hevc" }, async (context) => {
    const clientPath = join(context.clientDir, "PXL_clip.mp4");
    await writeFile(clientPath, VIDEO_BYTES);
    const beforeClient = await stat(clientPath);
    const videosBefore = context.libraryStore.listVideosWithTags().length;
    const libraryBefore = await readdir(context.libraryPath);

    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("PXL_clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 200);
    const body = response.json() as Record<string, unknown>;
    assert.equal(body.status, "completed");
    assert.equal(body.videoId, "PXL_clip.mp4");
    assert.equal(body.converted, true);
    assert.deepEqual(body.outputs, {
      source: "source",
      converted: "converted.mp4",
      thumbnail: "thumbnail.jpg",
    });
    assert.equal(typeof body.jobId, "string");
    assert.equal(JSON.stringify(body).includes(context.uploadTempPath.replaceAll("\\", "\\\\")), false);

    const jobId = String(body.jobId);
    const jobDir = join(context.uploadTempPath, jobId);
    const names = await readdir(jobDir);
    assert.ok(names.includes("source"));
    assert.ok(names.includes("converted.mp4"));
    assert.ok(names.includes("thumbnail.jpg"));

    const afterClient = await stat(clientPath);
    assert.equal(afterClient.size, beforeClient.size);
    assert.equal(afterClient.mtimeMs, beforeClient.mtimeMs);
    assert.equal(context.libraryStore.listVideosWithTags().length, videosBefore);
    assert.deepEqual(await readdir(context.libraryPath), libraryBefore);
    assert.equal(context.processor.convertCalls, 1);

    const status = await context.app.inject({
      method: "GET",
      url: `/api/admin/uploads/${jobId}`,
    });
    assert.equal(status.statusCode, 200);
    assert.equal(status.json().status, "completed");
    assert.equal(status.json().phase, "completed");
    assert.equal(status.json().converted, true);
  });
});

test("POST /api/admin/uploads skips conversion for H.264", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().converted, false);
    assert.equal(response.json().outputs.converted, null);
    assert.equal(context.processor.convertCalls, 0);

    const names = await readdir(join(context.uploadTempPath, String(response.json().jobId)));
    assert.ok(names.includes("source"));
    assert.ok(names.includes("thumbnail.jpg"));
    assert.equal(names.includes("converted.mp4"), false);
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

    if (nested.statusCode === 200) {
      assert.equal(nested.json().videoId, "archivo.mp4");
      const jobDir = join(context.uploadTempPath, String(nested.json().jobId));
      assert.equal(jobDir.startsWith(context.uploadTempPath), true);
    } else {
      assert.equal(nested.statusCode, 400);
    }
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

test("POST /api/admin/uploads returns a safe error when processing fails", async () => {
  await withUploadApp({ codec: "hevc", failAt: "probe" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().status, "failed");
    assert.equal(typeof response.json().jobId, "string");
    assert.equal(response.json().error.message, "Video processing failed.");
    assert.equal(JSON.stringify(response.json()).includes("C:\\secret"), false);
    assert.equal(context.jobs.findById(String(response.json().jobId))?.state.status, "failed");
  });
});

async function withUploadApp(
  options: { codec: string; failAt?: "probe" | "convert" | "thumbnail"; uploadMaxBytes?: number },
  run: (context: {
    app: Awaited<ReturnType<typeof createApp>>;
    processor: RecordingVideoProcessor;
    jobs: InMemoryProcessingJobStore;
    libraryStore: ReturnType<typeof openSqliteLibraryStore>;
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

  const libraryStore = openSqliteLibraryStore(":memory:");
  libraryStore.upsertVideo("existing.mp4");
  const jobs = new InMemoryProcessingJobStore();
  const processor = new RecordingVideoProcessor(options.codec, options.failAt);
  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath)),
    libraryPath,
    libraryStore,
    processVideoJobUseCase: new ProcessVideoJobUseCase(
      processor,
      new FilesystemProcessingWorkspace(uploadTempPath),
      jobs,
    ),
    processingJobStore: jobs,
    uploadMaxBytes: options.uploadMaxBytes ?? 1024 * 1024,
  });

  try {
    await run({ app, processor, jobs, libraryStore, libraryPath, uploadTempPath, clientDir });
  } finally {
    await app.close();
    libraryStore.close();
    await rm(root, { recursive: true, force: true });
  }
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

class RecordingVideoProcessor implements VideoProcessor {
  convertCalls = 0;

  constructor(
    private readonly videoCodec: string,
    private readonly failAt?: "probe" | "convert" | "thumbnail",
  ) {}

  async probe(_inputPath: string): Promise<VideoProbeResult> {
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

    await writeFile(outputPath, Buffer.from([0xff, 0xd8, 0xff]));
  }
}

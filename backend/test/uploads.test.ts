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
import { ProcessVideoJobUseCase } from "../src/application/process-video-job.js";
import { createProcessingJob, transitionProcessingJob } from "../src/application/processing-job.js";
import { RefreshLibraryUseCase } from "../src/application/refresh-library.js";
import { SyncNewVideosUseCase } from "../src/application/sync-new-videos.js";
import { toIndexedVideos } from "../src/application/to-indexed-videos.js";
import { PUBLIC_INSTALLATION_FAILED_MESSAGE } from "../src/application/install-processed-upload.js";
import { PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE } from "../src/application/video-already-exists-error.js";
import type { LibraryMediaInstaller } from "../src/ports/library-media-installer.js";
import type { LibraryStore } from "../src/ports/library-store.js";
import type { VideoProbeResult, VideoProcessor } from "../src/ports/video-processor.js";

const VIDEO_BYTES = Buffer.from("fake-video-bytes");
const THUMBNAIL_BYTES = Buffer.from([0xff, 0xd8, 0xff]);

test("POST /api/admin/uploads installs an HEVC video into the library", async () => {
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

    assert.equal(response.statusCode, 200);
    const body = response.json() as Record<string, unknown>;
    assert.equal(body.status, "completed");
    assert.equal(body.videoId, "PXL_clip.mp4");
    assert.equal(body.converted, true);
    assert.equal(body.installed, true);
    assert.deepEqual(body.outputs, {
      source: "source",
      converted: "converted.mp4",
      thumbnail: "thumbnail.jpg",
    });
    assert.equal(typeof body.jobId, "string");
    assert.equal(JSON.stringify(body).includes(context.uploadTempPath.replaceAll("\\", "\\\\")), false);
    assert.equal(JSON.stringify(body).includes(context.libraryPath.replaceAll("\\", "\\\\")), false);

    const jobId = String(body.jobId);
    const jobDir = join(context.uploadTempPath, jobId);
    const names = await readdir(jobDir);
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
  });
});

test("POST /api/admin/uploads installs an H.264 video without conversion", async () => {
  await withUploadApp({ codec: "h264" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().converted, false);
    assert.equal(response.json().installed, true);
    assert.equal(response.json().outputs.converted, null);
    assert.equal(context.processor.convertCalls, 0);

    const names = await readdir(join(context.uploadTempPath, String(response.json().jobId)));
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

    if (nested.statusCode === 200) {
      assert.equal(nested.json().videoId, "archivo.mp4");
      const jobDir = join(context.uploadTempPath, String(nested.json().jobId));
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
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
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
    assert.equal(first.statusCode, 200);

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

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().status, "failed");
    assert.equal(response.json().error.message, PUBLIC_INSTALLATION_FAILED_MESSAGE);
    assert.equal(context.jobs.findById(String(response.json().jobId))?.state.status, "failed");
    assert.equal((await readdir(context.libraryPath)).includes("clip.mp4"), false);
    assert.equal(context.libraryStore.findVideo("clip.mp4"), null);
    assert.ok((await readdir(join(context.uploadTempPath, String(response.json().jobId)))).includes("source"));
  });
});

test("POST /api/admin/uploads does not leave a library video when video install fails", async () => {
  await withUploadApp({ codec: "h264", failInstallAt: "video" }, async (context) => {
    const response = await context.app.inject({
      method: "POST",
      url: "/api/admin/uploads",
      ...multipartRequest("clip.mp4", VIDEO_BYTES),
    });

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.message, PUBLIC_INSTALLATION_FAILED_MESSAGE);
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

    assert.equal(response.statusCode, 500);
    assert.equal(response.json().error.message, PUBLIC_INSTALLATION_FAILED_MESSAGE);
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
    assert.equal(upload.statusCode, 200);

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
    uploadMaxBytes: options.uploadMaxBytes ?? 1024 * 1024,
  });

  try {
    await run({ app, processor, jobs, libraryStore, libraryPath, uploadTempPath, clientDir });
  } finally {
    await app.close();
    innerStore.close();
    await rm(root, { recursive: true, force: true });
  }
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

    await writeFile(outputPath, THUMBNAIL_BYTES);
  }
}

import { existsSync } from "node:fs";

import { FfmpegVideoProcessor } from "./adapters/ffmpeg/ffmpeg-video-processor.js";
import { FilesystemProcessingWorkspace } from "./adapters/filesystem/filesystem-processing-workspace.js";
import { InMemoryProcessingJobStore } from "./adapters/in-memory-processing-job-store.js";
import { InMemoryVideoIndex } from "./adapters/in-memory-video-index.js";
import { WorkspaceVideoDiscovery } from "./adapters/indexer/workspace-video-discovery.js";
import { SqliteLibraryIndexer } from "./adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "./adapters/sqlite/sqlite-library-store.js";
import { createApp } from "./app.js";
import { EnsureLibraryMediaUseCase } from "./application/ensure-library-media.js";
import { ProcessVideoJobUseCase } from "./application/process-video-job.js";
import { RefreshLibraryUseCase } from "./application/refresh-library.js";
import { SyncNewVideosUseCase } from "./application/sync-new-videos.js";
import { toIndexedVideos } from "./application/to-indexed-videos.js";
import { config } from "./config.js";
import { resolveFrontendDistPath } from "./resolve-frontend-dist.js";

async function main(): Promise<void> {
  const libraryPath = config.libraryPath;
  const port = config.port;
  const staticRoot = resolveFrontendDistPath(import.meta.url);
  const libraryStore = openSqliteLibraryStore(config.sqlitePath);
  let storeOpen = true;

  const closeStore = (): void => {
    if (!storeOpen) {
      return;
    }

    storeOpen = false;
    libraryStore.close();
  };

  try {
    const videoIndex = new InMemoryVideoIndex(
      toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath),
    );
    const videoDiscovery = new WorkspaceVideoDiscovery(libraryPath);
    const videoProcessor = new FfmpegVideoProcessor({
      ffmpegPath: config.ffmpegPath,
      ffprobePath: config.ffprobePath,
    });
    const refreshLibraryUseCase = new RefreshLibraryUseCase(
      new SyncNewVideosUseCase(videoDiscovery, libraryStore, libraryPath),
      new EnsureLibraryMediaUseCase(videoDiscovery, libraryStore, videoProcessor, libraryPath),
      new SqliteLibraryIndexer(libraryStore, libraryPath),
      videoIndex,
    );

    const processingJobStore = new InMemoryProcessingJobStore();
    const processVideoJobUseCase = new ProcessVideoJobUseCase(
      videoProcessor,
      new FilesystemProcessingWorkspace(config.uploadTempPath),
      processingJobStore,
    );

    const app = await createApp({
      videoIndex,
      libraryPath,
      libraryStore,
      refreshLibraryUseCase,
      processVideoJobUseCase,
      processingJobStore,
      uploadMaxBytes: config.uploadMaxBytes,
      staticRoot: existsSync(staticRoot) ? staticRoot : undefined,
    });

    app.addHook("onClose", async () => {
      closeStore();
    });

    if (!existsSync(staticRoot)) {
      console.warn(
        `Frontend build not found at ${staticRoot}. Run "pnpm --filter frontend build" to serve the web UI.`,
      );
    }

    await app.listen({ port, host: "0.0.0.0" });
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
    closeStore();
  }
}

void main();

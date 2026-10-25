import { existsSync } from "node:fs";

import { FfmpegVideoProcessor } from "./adapters/ffmpeg/ffmpeg-video-processor.js";
import { FilesystemProcessingWorkspace } from "./adapters/filesystem/filesystem-processing-workspace.js";
import { InMemoryProcessingJobStore } from "./adapters/in-memory-processing-job-store.js";
import { InMemoryVideoIndex } from "./adapters/in-memory-video-index.js";
import { WorkspaceVideoDiscovery } from "./adapters/indexer/workspace-video-discovery.js";
import { openStores } from "./adapters/persistence/open-stores.js";
import { SqliteLibraryIndexer } from "./adapters/sqlite/sqlite-library-indexer.js";
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
  const stores = await openStores(config.database);
  const libraryStore = stores.libraryStore;
  let storeOpen = true;

  let reloadTimer: ReturnType<typeof setInterval> | undefined;

  const closeStore = async (): Promise<void> => {
    if (reloadTimer !== undefined) {
      clearInterval(reloadTimer);
      reloadTimer = undefined;
    }

    if (!storeOpen) {
      return;
    }

    storeOpen = false;
    await stores.close();
  };

  try {
    const videoIndex = new InMemoryVideoIndex(
      toIndexedVideos(await libraryStore.listVideosWithTags(), libraryPath),
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
      authStore: stores.authStore,
      catalogBackup: stores.catalogBackup,
      sqlitePath: config.sqlitePath,
      authPublicRead: config.authPublicRead,
      refreshLibraryUseCase,
      processVideoJobUseCase,
      processingJobStore,
      uploadMaxBytes: config.uploadMaxBytes,
      staticRoot: existsSync(staticRoot) ? staticRoot : undefined,
    });

    if (config.indexReloadIntervalMs > 0) {
      reloadTimer = setInterval(() => {
        void libraryStore
          .listVideosWithTags()
          .then((videos) => {
            videoIndex.replaceVideos(toIndexedVideos(videos, libraryPath));
          })
          .catch((error: unknown) => {
            console.error("Failed to reload in-memory video index", error);
          });
      }, config.indexReloadIntervalMs);
      reloadTimer.unref();
    }

    app.addHook("onClose", async () => {
      await closeStore();
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
    await closeStore();
  }
}

void main();

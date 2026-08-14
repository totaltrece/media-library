import { existsSync } from "node:fs";

import { InMemoryVideoIndex } from "./adapters/in-memory-video-index.js";
import { SqliteLibraryIndexer } from "./adapters/sqlite/sqlite-library-indexer.js";
import { openSqliteLibraryStore } from "./adapters/sqlite/sqlite-library-store.js";
import { createApp } from "./app.js";
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

    const app = await createApp({
      videoIndex,
      libraryPath,
      libraryIndexer: new SqliteLibraryIndexer(libraryStore, libraryPath),
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

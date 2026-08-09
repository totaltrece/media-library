import { existsSync } from "node:fs";

import { indexLibrary } from "@media-library/indexer";

import { InMemoryVideoIndex } from "./adapters/in-memory-video-index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { resolveFrontendDistPath } from "./resolve-frontend-dist.js";

async function main(): Promise<void> {
  const libraryPath = config.libraryPath;
  const port = config.port;
  const staticRoot = resolveFrontendDistPath(import.meta.url);

  let indexedVideos: Awaited<ReturnType<typeof indexLibrary>>;

  try {
    indexedVideos = await indexLibrary(libraryPath);
  } catch (error: unknown) {
    console.error("Unable to index library:", error);
    process.exitCode = 1;
    return;
  }

  const app = await createApp({
    videoIndex: new InMemoryVideoIndex(indexedVideos),
    libraryPath,
    staticRoot: existsSync(staticRoot) ? staticRoot : undefined,
  });

  if (!existsSync(staticRoot)) {
    console.warn(
      `Frontend build not found at ${staticRoot}. Run "pnpm --filter frontend build" to serve the web UI.`,
    );
  }

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();

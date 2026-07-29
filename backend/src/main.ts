import { indexLibrary } from "@media-library/indexer";

import { InMemoryVideoIndex } from "./adapters/in-memory-video-index.js";
import { createApp } from "./app.js";
import { config } from "./config.js";

const defaultPort = 3000;

async function main(): Promise<void> {
  const libraryPath = config.libraryPath

  const port = Number(config.port ?? defaultPort);

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
  });

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();

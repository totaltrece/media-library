import { indexLibrary } from "@media-library/indexer";

import { InMemoryVideoIndex } from "./adapters/in-memory-video-index.js";
import { createApp } from "./app.js";

const defaultPort = 3000;

async function main(): Promise<void> {
  const libraryPath = process.env.LIBRARY_PATH;

  if (libraryPath === undefined || libraryPath.length === 0) {
    console.error("LIBRARY_PATH environment variable is required.");
    process.exitCode = 1;
    return;
  }

  const port = Number(process.env.PORT ?? defaultPort);

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

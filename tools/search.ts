import { basename } from "node:path";

import { indexLibrary } from "../packages/indexer/src/index.js";
import { searchVideos } from "../packages/search/src/index.js";

interface CommandArguments {
  libraryPath: string;
  tags: string[];
}

async function main(arguments_: string[]): Promise<void> {
  const commandArguments = parseArguments(arguments_);

  if (commandArguments === undefined) {
    console.error("Usage: pnpm search --library <path> [tags...]");
    process.exitCode = 1;
    return;
  }

  console.log("Scanning library...");

  let indexedVideos: Awaited<ReturnType<typeof indexLibrary>>;

  try {
    indexedVideos = await indexLibrary(commandArguments.libraryPath);
  } catch (error: unknown) {
    console.error(`Unable to index library: ${errorMessage(error)}`);
    process.exitCode = 2;
    return;
  }

  const matches = searchVideos(indexedVideos, { tags: commandArguments.tags });

  console.log(`\nIndexed ${indexedVideos.length} videos.`);
  console.log(`\nFound ${matches.length} matches.`);

  for (const video of matches) {
    console.log("\n--------------------------------------------------");
    console.log(basename(video.videoPath));
    console.log(video.tags.join(", "));
  }
}

function parseArguments(arguments_: string[]): CommandArguments | undefined {
  const libraryFlagIndex = arguments_.indexOf("--library");

  if (
    libraryFlagIndex === -1 ||
    libraryFlagIndex === arguments_.length - 1 ||
    arguments_.filter((argument) => argument === "--library").length !== 1
  ) {
    return undefined;
  }

  const libraryPath = arguments_[libraryFlagIndex + 1];

  if (libraryPath.length === 0) {
    return undefined;
  }

  return {
    libraryPath,
    tags: [...arguments_.slice(0, libraryFlagIndex), ...arguments_.slice(libraryFlagIndex + 2)],
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

void main(process.argv.slice(2));

import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const videoExtensions = new Set([".mp4", ".mov", ".mkv", ".avi"]);

export interface IndexedVideo {
  videoPath: string;
  metadataPath: string | undefined;
  thumbnailPath: string | undefined;
}

/**
 * Indexes video files below a library directory without modifying the library.
 * TagSpaces sidecars are expected at <library>/.ts/<video-file-name>.<extension>.
 */
export async function indexLibrary(libraryPath: string): Promise<IndexedVideo[]> {
  const videoPaths = await findVideoPaths(libraryPath);

  return Promise.all(
    videoPaths.map(async (videoPath) => {
      const sidecarBasePath = join(libraryPath, ".ts", basename(videoPath));

      return {
        videoPath,
        metadataPath: await existingFilePath(`${sidecarBasePath}.json`),
        thumbnailPath: await existingFilePath(`${sidecarBasePath}.jpg`),
      };
    }),
  );
}

async function findVideoPaths(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const videoPaths: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      videoPaths.push(...(await findVideoPaths(entryPath)));
      continue;
    }

    if (entry.isFile() && videoExtensions.has(extname(entry.name).toLowerCase())) {
      videoPaths.push(entryPath);
    }
  }

  return videoPaths.sort((firstPath, secondPath) => firstPath.localeCompare(secondPath));
}

async function existingFilePath(path: string): Promise<string | undefined> {
  try {
    return (await stat(path)).isFile() ? path : undefined;
  } catch (error: unknown) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

import { basename, join } from "node:path";

import { resolveMediaPath } from "./resolve-media-id.js";

export function resolveLibraryVideoPath(libraryPath: string, videoId: string): string | undefined {
  return resolveMediaPath(libraryPath, videoId);
}

/**
 * TagSpaces thumbnail layout: `LIBRARY_PATH/.ts/<basename(video)>.jpg`.
 * Nested media ids still flatten to the video basename inside `.ts/`.
 */
export function resolveLibraryThumbnailPath(libraryPath: string, videoId: string): string | undefined {
  const videoPath = resolveMediaPath(libraryPath, videoId);

  if (videoPath === undefined) {
    return undefined;
  }

  return join(libraryPath, ".ts", `${basename(videoPath)}.jpg`);
}

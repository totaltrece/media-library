import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import { resolveMediaPath } from "../../application/resolve-media-id.js";
import type { ThumbnailResult, ThumbnailStore } from "../../ports/thumbnail-store.js";

export class TagSpacesThumbnailStore implements ThumbnailStore {
  constructor(private readonly libraryPath: string) {}

  async getThumbnail(mediaId: string): Promise<ThumbnailResult | null> {
    const videoPath = resolveMediaPath(this.libraryPath, mediaId);

    if (videoPath === undefined) {
      return null;
    }

    if (!(await isExistingFile(videoPath))) {
      return null;
    }

    const thumbnailPath = join(this.libraryPath, ".ts", `${basename(videoPath)}.jpg`);

    if (!(await isExistingFile(thumbnailPath))) {
      return null;
    }

    return {
      data: await readFile(thumbnailPath),
      contentType: "image/jpeg",
    };
  }
}

async function isExistingFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

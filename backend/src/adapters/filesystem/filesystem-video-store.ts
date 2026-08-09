import { stat } from "node:fs/promises";

import { resolveMediaPath } from "../../application/resolve-media-id.js";
import { contentTypeForVideoPath } from "../../application/video-content-type.js";
import type { VideoMetadata, VideoStore } from "../../ports/video-store.js";

export class FilesystemVideoStore implements VideoStore {
  constructor(private readonly libraryPath: string) {}

  async getVideo(mediaId: string): Promise<VideoMetadata | null> {
    const videoPath = resolveMediaPath(this.libraryPath, mediaId);

    if (videoPath === undefined) {
      return null;
    }

    try {
      const fileStat = await stat(videoPath);

      if (!fileStat.isFile()) {
        return null;
      }

      return {
        path: videoPath,
        size: fileStat.size,
        contentType: contentTypeForVideoPath(videoPath),
      };
    } catch {
      return null;
    }
  }
}

import { constants } from "node:fs";
import { copyFile, mkdir, stat, unlink } from "node:fs/promises";
import { dirname } from "node:path";

import {
  resolveLibraryThumbnailPath,
  resolveLibraryVideoPath,
} from "../../application/library-media-paths.js";
import type {
  LibraryMediaInstaller,
  LibraryMediaPresence,
} from "../../ports/library-media-installer.js";

export class FilesystemLibraryMediaInstaller implements LibraryMediaInstaller {
  constructor(private readonly libraryPath: string) {}

  async exists(videoId: string): Promise<LibraryMediaPresence> {
    const videoPath = this.requireVideoPath(videoId);
    const thumbnailPath = this.requireThumbnailPath(videoId);

    return {
      video: await isExistingFile(videoPath),
      thumbnail: await isExistingFile(thumbnailPath),
    };
  }

  async installVideo(sourcePath: string, videoId: string): Promise<void> {
    const destinationPath = this.requireVideoPath(videoId);
    await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
  }

  async installThumbnail(sourcePath: string, videoId: string): Promise<void> {
    const destinationPath = this.requireThumbnailPath(videoId);
    await mkdir(dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath, constants.COPYFILE_EXCL);
  }

  async removeVideo(videoId: string): Promise<void> {
    await removeFileIfExists(this.requireVideoPath(videoId));
  }

  async removeThumbnail(videoId: string): Promise<void> {
    await removeFileIfExists(this.requireThumbnailPath(videoId));
  }

  private requireVideoPath(videoId: string): string {
    const videoPath = resolveLibraryVideoPath(this.libraryPath, videoId);

    if (videoPath === undefined) {
      throw new Error("Invalid video id");
    }

    return videoPath;
  }

  private requireThumbnailPath(videoId: string): string {
    const thumbnailPath = resolveLibraryThumbnailPath(this.libraryPath, videoId);

    if (thumbnailPath === undefined) {
      throw new Error("Invalid video id");
    }

    return thumbnailPath;
  }
}

async function isExistingFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function removeFileIfExists(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error: unknown) {
    if (isNotFoundError(error)) {
      return;
    }

    throw error;
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

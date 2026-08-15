export interface LibraryMediaPresence {
  video: boolean;
  thumbnail: boolean;
}

/**
 * Places processed upload artifacts into the media library.
 * Implementations must not overwrite existing files.
 */
export interface LibraryMediaInstaller {
  exists(videoId: string): Promise<LibraryMediaPresence>;
  installVideo(sourcePath: string, videoId: string): Promise<void>;
  installThumbnail(sourcePath: string, videoId: string): Promise<void>;
  removeVideo(videoId: string): Promise<void>;
  removeThumbnail(videoId: string): Promise<void>;
}

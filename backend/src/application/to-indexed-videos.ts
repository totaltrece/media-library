import type { IndexedVideo } from "@media-library/indexer";

import type { LibraryVideoWithTags } from "../ports/library-store.js";

import { resolveMediaPath } from "./resolve-media-id.js";

export function toIndexedVideo(video: LibraryVideoWithTags, libraryPath: string): IndexedVideo {
  const videoPath = resolveMediaPath(libraryPath, video.id);

  if (videoPath === undefined) {
    throw new Error(`Invalid media id in library store: ${video.id}`);
  }

  return {
    videoPath,
    tags: video.tags,
    recordedAt: video.recordedAt,
  };
}

export function toIndexedVideos(videos: LibraryVideoWithTags[], libraryPath: string): IndexedVideo[] {
  return videos
    .map((video) => toIndexedVideo(video, libraryPath))
    .sort((firstVideo, secondVideo) => firstVideo.videoPath.localeCompare(secondVideo.videoPath));
}

import { basename, relative } from "node:path";

import type { IndexedVideo } from "@media-library/indexer";

export interface SearchResultItem {
  id: string;
  name: string;
  thumbnail: string;
  video: string;
  tags: string[];
}

export interface SearchResponse {
  query: {
    tags: string[];
  };
  count: number;
  results: SearchResultItem[];
}

export function toMediaId(videoPath: string, libraryPath: string): string {
  return relative(libraryPath, videoPath).split("\\").join("/");
}

export function toSearchResult(video: IndexedVideo, libraryPath: string): SearchResultItem {
  const id = toMediaId(video.videoPath, libraryPath);

  return {
    id,
    name: basename(video.videoPath),
    thumbnail: toThumbnailUrl(id),
    video: toVideoUrl(id),
    tags: video.tags,
  };
}

export function toThumbnailUrl(mediaId: string): string {
  return `/api/thumbnail/${mediaId}`;
}

export function toVideoUrl(mediaId: string): string {
  return `/api/video/${mediaId}`;
}

export function buildSearchResponse(
  requestedTags: string[],
  matches: IndexedVideo[],
  libraryPath: string,
): SearchResponse {
  return {
    query: {
      tags: requestedTags,
    },
    count: matches.length,
    results: matches.map((video) => toSearchResult(video, libraryPath)),
  };
}

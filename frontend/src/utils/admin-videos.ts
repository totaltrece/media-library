import type { SearchResultItem } from "../api/types.js";

export function applyUntaggedFilter(
  videos: SearchResultItem[],
  untaggedOnly: boolean,
): SearchResultItem[] {
  if (!untaggedOnly) {
    return videos;
  }

  return videos.filter((video) => video.tags.length === 0);
}

export function countUntaggedVideos(videos: SearchResultItem[]): number {
  return videos.filter((video) => video.tags.length === 0).length;
}

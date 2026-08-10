import type { IndexedVideo } from "@media-library/indexer";

export interface SearchQuery {
  tags?: string[];
}

/**
 * Returns videos that contain every requested tag, preserving input order.
 */
export function searchVideos(videos: IndexedVideo[], query: SearchQuery): IndexedVideo[] {
  const requestedTags = new Set(query.tags?.map(normalizeTag) ?? []);

  if (requestedTags.size === 0) {
    return videos;
  }

  return videos.filter((video) => {
    const videoTags = new Set(video.tags.map(normalizeTag));

    return [...requestedTags].every((tag) => videoTags.has(tag));
  });
}

function normalizeTag(tag: string): string {
  return tag.toLowerCase();
}

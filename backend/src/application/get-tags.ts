import type { IndexedVideo } from "@media-library/indexer";

import type { VideoIndex } from "../ports/video-index.js";

export interface TagsResponse {
  count: number;
  tags: string[];
}

export function collectDistinctTags(videos: IndexedVideo[]): string[] {
  const uniqueTags = new Set<string>();

  for (const video of videos) {
    for (const tag of video.tags) {
      uniqueTags.add(tag);
    }
  }

  return [...uniqueTags].sort((firstTag, secondTag) => firstTag.localeCompare(secondTag));
}

export class GetTagsUseCase {
  constructor(private readonly videoIndex: VideoIndex) {}

  execute(): TagsResponse {
    const tags = collectDistinctTags(this.videoIndex.getVideos());

    return {
      count: tags.length,
      tags,
    };
  }
}

import type { IndexedVideo } from "@media-library/indexer";

import { DEFAULT_TAG_COLOR } from "./tag-type-color.js";
import type { LibraryStore } from "../ports/library-store.js";
import type { VideoIndex } from "../ports/video-index.js";

export interface TagListItem {
  name: string;
  color: string;
}

export interface TagsResponse {
  count: number;
  tags: TagListItem[];
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
  constructor(
    private readonly videoIndex: VideoIndex,
    private readonly libraryStore?: LibraryStore,
  ) {}

  execute(): TagsResponse {
    const names = collectDistinctTags(this.videoIndex.getVideos());
    const colors = new Map((this.libraryStore?.listTags() ?? []).map((tag) => [tag.name, tag.color]));
    const defaultColor = this.libraryStore?.findDefaultTagType()?.color ?? DEFAULT_TAG_COLOR;

    return {
      count: names.length,
      tags: names.map((name) => ({
        name,
        color: colors.get(name) ?? defaultColor,
      })),
    };
  }
}

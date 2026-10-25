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

  async execute(): Promise<TagsResponse> {
    const names = collectDistinctTags(this.videoIndex.getVideos());
    const storedTags = this.libraryStore === undefined ? [] : await this.libraryStore.listTags();
    const colors = new Map(storedTags.map((tag) => [tag.name, tag.color]));
    const defaultType = this.libraryStore === undefined ? null : await this.libraryStore.findDefaultTagType();
    const defaultColor = defaultType?.color ?? DEFAULT_TAG_COLOR;

    return {
      count: names.length,
      tags: names.map((name) => ({
        name,
        color: colors.get(name) ?? defaultColor,
      })),
    };
  }
}

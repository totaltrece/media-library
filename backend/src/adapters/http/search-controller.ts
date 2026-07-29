import { basename, relative } from "node:path";

import type { IndexedVideo } from "@media-library/indexer";
import type { FastifyInstance } from "fastify";

import type { SearchVideosUseCase } from "../../application/search-videos.js";

export interface SearchControllerOptions {
  libraryPath: string;
  searchVideosUseCase: SearchVideosUseCase;
}

export function registerSearchRoutes(
  app: FastifyInstance,
  options: SearchControllerOptions,
): void {
  app.get("/search", async (request) => {
    const tags = parseTagsQuery(request.query);

    const matches = options.searchVideosUseCase.execute({ tags });

    return {
      count: matches.length,
      results: matches.map((video) => toSearchResult(video, options.libraryPath)),
    };
  });
}

function parseTagsQuery(query: unknown): string[] | undefined {
  if (typeof query !== "object" || query === null || !("tags" in query)) {
    return undefined;
  }

  const rawTags = query.tags;

  if (typeof rawTags !== "string" || rawTags.length === 0) {
    return undefined;
  }

  const tags = rawTags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return tags.length > 0 ? tags : undefined;
}

function toSearchResult(video: IndexedVideo, libraryPath: string) {
  return {
    path: relative(libraryPath, video.videoPath),
    thumbnail: `/thumbnails/${basename(video.videoPath)}.jpg`,
    tags: video.tags,
  };
}

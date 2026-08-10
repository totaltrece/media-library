import type { FastifyInstance } from "fastify";

import type { SearchVideosUseCase } from "../../application/search-videos.js";
import { buildSearchResponse } from "./search-response.js";

export interface SearchControllerOptions {
  libraryPath: string;
  searchVideosUseCase: SearchVideosUseCase;
}

export function registerSearchRoutes(
  app: FastifyInstance,
  options: SearchControllerOptions,
): void {
  app.get("/search", async (request) => {
    const requestedTags = parseTagQuery(request.query);
    const searchTags = requestedTags.length > 0 ? requestedTags : undefined;

    const matches = options.searchVideosUseCase.execute({ tags: searchTags });

    return buildSearchResponse(requestedTags, matches, options.libraryPath);
  });
}

export function parseTagQuery(query: unknown): string[] {
  if (typeof query !== "object" || query === null || !("tag" in query)) {
    return [];
  }

  const rawTag = query.tag;

  if (typeof rawTag === "string") {
    return rawTag.length > 0 ? [rawTag] : [];
  }

  if (Array.isArray(rawTag)) {
    return rawTag.filter((tag): tag is string => typeof tag === "string");
  }

  return [];
}

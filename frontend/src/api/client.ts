import type { ApiErrorResponse, RefreshLibraryResponse, SearchResponse, TagsResponse } from "./types.js";

const API_PREFIX = "/api";

export function buildApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith(`${API_PREFIX}/`) || path === API_PREFIX) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${API_PREFIX}${normalizedPath}`;
}

export function buildSearchUrl(tags: string[]): string {
  const params = new URLSearchParams();

  for (const tag of tags) {
    params.append("tag", tag);
  }

  const query = params.toString();

  return buildApiUrl(query.length > 0 ? `/search?${query}` : "/search");
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;

    try {
      const errorBody = (await response.json()) as ApiErrorResponse;

      if (typeof errorBody.error?.message === "string") {
        message = errorBody.error.message;
      }
    } catch {
      // Keep the default message when the body is not JSON.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchTags(): Promise<TagsResponse> {
  const response = await fetch(buildApiUrl("/tags"));

  return readJsonResponse<TagsResponse>(response);
}

export async function searchVideos(tags: string[]): Promise<SearchResponse> {
  const response = await fetch(buildSearchUrl(tags));

  return readJsonResponse<SearchResponse>(response);
}

export async function refreshLibrary(): Promise<RefreshLibraryResponse> {
  const response = await fetch(buildApiUrl("/library/refresh"), {
    method: "POST",
  });

  return readJsonResponse<RefreshLibraryResponse>(response);
}

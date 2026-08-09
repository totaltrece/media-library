import type { ApiErrorResponse, SearchResponse, TagsResponse } from "./types.js";

const apiBase = import.meta.env.VITE_API_BASE ?? "";

export function buildApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${apiBase}${path}`;
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

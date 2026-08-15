import type {
  ApiErrorResponse,
  CatalogTag,
  CatalogTagsResponse,
  RefreshLibraryResponse,
  SearchResponse,
  TagsResponse,
  UploadAcceptedResponse,
  UploadJobView,
  VideoTagsResponse,
} from "./types.js";

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

export class ApiRequestError extends Error {
  readonly status: number;
  readonly jobId: string | null;

  constructor(message: string, status: number, jobId: string | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.jobId = jobId;
  }
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    let jobId: string | null = null;

    try {
      const errorBody = (await response.json()) as ApiErrorResponse & { jobId?: unknown };

      if (typeof errorBody.error?.message === "string") {
        message = errorBody.error.message;
      }

      if (typeof errorBody.jobId === "string" && errorBody.jobId.length > 0) {
        jobId = errorBody.jobId;
      }
    } catch {
      // Keep the default message when the body is not JSON.
    }

    throw new ApiRequestError(message, response.status, jobId);
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

export function buildVideoUrl(mediaId: string): string {
  return buildApiUrl(`/videos/${mediaId}`);
}

export function buildVideoTagsUrl(mediaId: string): string {
  return buildApiUrl(`/videos/${mediaId}/tags`);
}

export async function deleteVideo(mediaId: string): Promise<void> {
  const response = await fetch(buildVideoUrl(mediaId), {
    method: "DELETE",
  });

  await readJsonResponse<{ id: string }>(response);
}

export async function fetchVideoTags(mediaId: string): Promise<VideoTagsResponse> {
  const response = await fetch(buildVideoTagsUrl(mediaId));

  return readJsonResponse<VideoTagsResponse>(response);
}

export async function updateVideoTags(mediaId: string, tags: string[]): Promise<VideoTagsResponse> {
  const response = await fetch(buildVideoTagsUrl(mediaId), {
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
    body: JSON.stringify({ tags }),
  });

  return readJsonResponse<VideoTagsResponse>(response);
}

export async function fetchTagCatalog(): Promise<CatalogTagsResponse> {
  const response = await fetch(buildApiUrl("/admin/tags"));

  return readJsonResponse<CatalogTagsResponse>(response);
}

export async function renameCatalogTag(tagId: number, name: string): Promise<CatalogTag> {
  const response = await fetch(buildApiUrl(`/admin/tags/${tagId}`), {
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
    body: JSON.stringify({ name }),
  });

  return readJsonResponse<CatalogTag>(response);
}

export async function deleteCatalogTag(tagId: number): Promise<void> {
  const response = await fetch(buildApiUrl(`/admin/tags/${tagId}`), {
    method: "DELETE",
  });

  await readJsonResponse<{ id: number }>(response);
}

export function buildUploadJobUrl(jobId: string): string {
  return buildApiUrl(`/admin/uploads/${jobId}`);
}

export function buildActiveUploadJobUrl(): string {
  return buildApiUrl("/admin/uploads/active");
}

export async function uploadVideo(file: File): Promise<UploadAcceptedResponse> {
  const body = new FormData();
  body.append("video", file);

  const response = await fetch(buildApiUrl("/admin/uploads"), {
    method: "POST",
    body,
  });

  return readJsonResponse<UploadAcceptedResponse>(response);
}

export async function fetchUploadJob(jobId: string): Promise<UploadJobView> {
  const response = await fetch(buildUploadJobUrl(jobId));

  return readJsonResponse<UploadJobView>(response);
}

export async function fetchActiveUploadJob(): Promise<UploadJobView | null> {
  const response = await fetch(buildActiveUploadJobUrl());

  if (response.status === 404) {
    return null;
  }

  return readJsonResponse<UploadJobView>(response);
}

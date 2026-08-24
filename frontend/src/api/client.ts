import type {
  ApiErrorResponse,
  AuthMe,
  CatalogTag,
  CatalogTagsResponse,
  RefreshLibraryResponse,
  SearchResponse,
  TagType,
  TagTypesResponse,
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

function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(buildApiUrl(path), {
    credentials: "include",
    ...init,
  });
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
  const response = await apiFetch("/tags");

  return readJsonResponse<TagsResponse>(response);
}

export async function searchVideos(tags: string[]): Promise<SearchResponse> {
  const response = await apiFetch(buildSearchUrl(tags));

  return readJsonResponse<SearchResponse>(response);
}

export async function refreshLibrary(): Promise<RefreshLibraryResponse> {
  const response = await apiFetch("/library/refresh", {
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
  const response = await apiFetch(buildVideoUrl(mediaId), {
    method: "DELETE",
  });

  await readJsonResponse<{ id: string }>(response);
}

export async function fetchVideoTags(mediaId: string): Promise<VideoTagsResponse> {
  const response = await apiFetch(buildVideoTagsUrl(mediaId));

  return readJsonResponse<VideoTagsResponse>(response);
}

export async function updateVideoTags(mediaId: string, tags: string[]): Promise<VideoTagsResponse> {
  const response = await apiFetch(buildVideoTagsUrl(mediaId), {
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
    body: JSON.stringify({ tags }),
  });

  return readJsonResponse<VideoTagsResponse>(response);
}

export async function fetchTagCatalog(): Promise<CatalogTagsResponse> {
  const response = await apiFetch("/admin/tags");

  return readJsonResponse<CatalogTagsResponse>(response);
}

export async function updateCatalogTag(
  tagId: number,
  name: string,
  typeId: number,
): Promise<CatalogTag> {
  const response = await apiFetch(`/admin/tags/${tagId}`, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
    body: JSON.stringify({ name, typeId }),
  });

  return readJsonResponse<CatalogTag>(response);
}

export async function deleteCatalogTag(tagId: number): Promise<void> {
  const response = await apiFetch(`/admin/tags/${tagId}`, {
    method: "DELETE",
  });

  await readJsonResponse<{ id: number }>(response);
}

export async function fetchTagTypes(): Promise<TagTypesResponse> {
  const response = await apiFetch("/admin/tag-types");

  return readJsonResponse<TagTypesResponse>(response);
}

export async function createTagType(name: string, color: string): Promise<TagType> {
  const response = await apiFetch("/admin/tag-types", {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({ name, color }),
  });

  return readJsonResponse<TagType>(response);
}

export async function updateTagType(tagTypeId: number, name: string, color: string): Promise<TagType> {
  const response = await apiFetch(`/admin/tag-types/${tagTypeId}`, {
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
    body: JSON.stringify({ name, color }),
  });

  return readJsonResponse<TagType>(response);
}

export async function deleteTagType(tagTypeId: number): Promise<void> {
  const response = await apiFetch(`/admin/tag-types/${tagTypeId}`, {
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

  const response = await apiFetch("/admin/uploads", {
    method: "POST",
    body,
  });

  return readJsonResponse<UploadAcceptedResponse>(response);
}

export async function fetchUploadJob(jobId: string): Promise<UploadJobView> {
  const response = await apiFetch(buildUploadJobUrl(jobId));

  return readJsonResponse<UploadJobView>(response);
}

export async function fetchActiveUploadJob(): Promise<UploadJobView | null> {
  const response = await apiFetch(buildActiveUploadJobUrl());

  if (response.status === 404) {
    return null;
  }

  return readJsonResponse<UploadJobView>(response);
}

export async function fetchAuthMe(): Promise<AuthMe> {
  const response = await apiFetch("/auth/me");

  return readJsonResponse<AuthMe>(response);
}

export async function login(username: string, password: string): Promise<AuthMe> {
  const response = await apiFetch("/auth/login", {
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  return readJsonResponse<AuthMe>(response);
}

export async function logout(): Promise<AuthMe> {
  const response = await apiFetch("/auth/logout", {
    method: "POST",
  });

  return readJsonResponse<AuthMe>(response);
}

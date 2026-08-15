export interface TagsResponse {
  count: number;
  tags: string[];
}

export interface SearchResultItem {
  id: string;
  name: string;
  thumbnail: string;
  video: string;
  tags: string[];
}

export interface SearchResponse {
  query: {
    tags: string[];
  };
  count: number;
  results: SearchResultItem[];
}

export interface ApiErrorResponse {
  error: {
    message: string;
  };
}

export interface RefreshLibraryResponse {
  count: number;
}

export interface VideoTagsResponse {
  tags: string[];
}

export interface CatalogTag {
  id: number;
  name: string;
  usageCount: number;
}

export interface CatalogTagsResponse {
  count: number;
  tags: CatalogTag[];
}

export type UploadJobStatus = "idle" | "uploading" | "processing" | "completed" | "failed";

export type UploadJobPhase =
  | "idle"
  | "uploading"
  | "processing"
  | "generating_thumbnail"
  | "finalizing"
  | "installing"
  | "completed"
  | "failed";

export interface UploadJobOutputs {
  source: "source";
  converted: "converted.mp4" | null;
  thumbnail: "thumbnail.jpg";
}

export interface UploadAcceptedResponse {
  jobId: string;
  status: UploadJobStatus;
}

export interface UploadJobView {
  jobId: string;
  status: UploadJobStatus;
  phase: UploadJobPhase;
  videoId: string | null;
  converted: boolean | null;
  progress: number | null;
  outputs: UploadJobOutputs | null;
  error?: {
    message: string;
  };
}

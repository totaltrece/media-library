export interface TagListItem {
  name: string;
  color: string;
}

export interface TagsResponse {
  count: number;
  tags: TagListItem[];
}

export interface SearchResultItem {
  id: string;
  name: string;
  thumbnail: string;
  video: string;
  tags: string[];
  recordedAt: string | null;
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
  typeId: number;
  typeName: string;
  color: string;
  typeSortOrder: number;
}

export interface CatalogTagsResponse {
  count: number;
  tags: CatalogTag[];
}

export interface TagType {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  tagCount: number;
}

export interface TagTypesResponse {
  count: number;
  types: TagType[];
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

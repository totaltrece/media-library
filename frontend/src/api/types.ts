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

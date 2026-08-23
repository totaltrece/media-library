export interface LibraryVideo {
  id: string;
  recordedAt: string | null;
}

export interface LibraryTagType {
  id: number;
  name: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  tagCount: number;
}

export interface LibraryTag {
  id: number;
  name: string;
  typeId: number;
  typeName: string;
  color: string;
  typeSortOrder: number;
}

export interface LibraryTagUsage extends LibraryTag {
  usageCount: number;
}

export interface LibraryVideoWithTags {
  id: string;
  recordedAt: string | null;
  tags: string[];
}

export interface LibraryStore {
  initialize(): void;
  close(): void;
  upsertVideo(id: string, recordedAt?: string | null): LibraryVideo;
  findVideo(id: string): LibraryVideo | null;
  listVideos(): LibraryVideo[];
  deleteVideo(id: string): void;
  setVideoRecordedAt(id: string, recordedAt: string | null): LibraryVideo;
  upsertTag(name: string): LibraryTag;
  findTagById(id: number): LibraryTag | null;
  findTagByName(name: string): LibraryTag | null;
  listTags(): LibraryTag[];
  listTagUsages(): LibraryTagUsage[];
  updateTag(id: number, name: string, typeId: number): LibraryTag;
  deleteTag(id: number): void;
  listTagTypes(): LibraryTagType[];
  findTagTypeById(id: number): LibraryTagType | null;
  findDefaultTagType(): LibraryTagType | null;
  createTagType(name: string, color: string): LibraryTagType;
  updateTagType(id: number, name: string, color: string): LibraryTagType;
  deleteTagType(id: number): void;
  setVideoTags(videoId: string, tagNames: string[]): void;
  addVideoTag(videoId: string, tagName: string): void;
  removeVideoTag(videoId: string, tagName: string): void;
  getVideoTags(videoId: string): string[];
  listVideosWithTags(): LibraryVideoWithTags[];
}

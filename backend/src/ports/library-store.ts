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
  initialize(): Promise<void>;
  close(): Promise<void>;
  upsertVideo(id: string, recordedAt?: string | null): Promise<LibraryVideo>;
  findVideo(id: string): Promise<LibraryVideo | null>;
  listVideos(): Promise<LibraryVideo[]>;
  deleteVideo(id: string): Promise<void>;
  setVideoRecordedAt(id: string, recordedAt: string | null): Promise<LibraryVideo>;
  upsertTag(name: string): Promise<LibraryTag>;
  findTagById(id: number): Promise<LibraryTag | null>;
  findTagByName(name: string): Promise<LibraryTag | null>;
  listTags(): Promise<LibraryTag[]>;
  listTagUsages(): Promise<LibraryTagUsage[]>;
  updateTag(id: number, name: string, typeId: number): Promise<LibraryTag>;
  deleteTag(id: number): Promise<void>;
  listTagTypes(): Promise<LibraryTagType[]>;
  findTagTypeById(id: number): Promise<LibraryTagType | null>;
  findDefaultTagType(): Promise<LibraryTagType | null>;
  createTagType(name: string, color: string): Promise<LibraryTagType>;
  updateTagType(id: number, name: string, color: string): Promise<LibraryTagType>;
  deleteTagType(id: number): Promise<void>;
  setVideoTags(videoId: string, tagNames: string[]): Promise<void>;
  addVideoTag(videoId: string, tagName: string): Promise<void>;
  removeVideoTag(videoId: string, tagName: string): Promise<void>;
  getVideoTags(videoId: string): Promise<string[]>;
  listVideosWithTags(): Promise<LibraryVideoWithTags[]>;
}

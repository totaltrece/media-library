export interface LibraryVideo {
  id: string;
}

export interface LibraryTag {
  id: number;
  name: string;
}

export interface LibraryTagUsage {
  id: number;
  name: string;
  usageCount: number;
}

export interface LibraryVideoWithTags {
  id: string;
  tags: string[];
}

export interface LibraryStore {
  initialize(): void;
  close(): void;
  upsertVideo(id: string): LibraryVideo;
  findVideo(id: string): LibraryVideo | null;
  listVideos(): LibraryVideo[];
  deleteVideo(id: string): void;
  upsertTag(name: string): LibraryTag;
  findTagById(id: number): LibraryTag | null;
  findTagByName(name: string): LibraryTag | null;
  listTags(): LibraryTag[];
  listTagUsages(): LibraryTagUsage[];
  renameTag(id: number, name: string): LibraryTag;
  deleteTag(id: number): void;
  setVideoTags(videoId: string, tagNames: string[]): void;
  addVideoTag(videoId: string, tagName: string): void;
  removeVideoTag(videoId: string, tagName: string): void;
  getVideoTags(videoId: string): string[];
  listVideosWithTags(): LibraryVideoWithTags[];
}

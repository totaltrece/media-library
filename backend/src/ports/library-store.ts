export interface LibraryVideo {
  id: string;
}

export interface LibraryTag {
  id: number;
  name: string;
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
  upsertTag(name: string): LibraryTag;
  findTagByName(name: string): LibraryTag | null;
  listTags(): LibraryTag[];
  setVideoTags(videoId: string, tagNames: string[]): void;
  addVideoTag(videoId: string, tagName: string): void;
  removeVideoTag(videoId: string, tagName: string): void;
  getVideoTags(videoId: string): string[];
  listVideosWithTags(): LibraryVideoWithTags[];
}

import type { LibraryStore } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { toIndexedVideos } from "./to-indexed-videos.js";

export function reloadVideoIndex(
  libraryStore: LibraryStore,
  videoIndex: MutableVideoIndex,
  libraryPath: string,
): void {
  videoIndex.replaceVideos(toIndexedVideos(libraryStore.listVideosWithTags(), libraryPath));
}

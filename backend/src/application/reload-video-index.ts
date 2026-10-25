import type { LibraryStore } from "../ports/library-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { toIndexedVideos } from "./to-indexed-videos.js";

export async function reloadVideoIndex(
  libraryStore: LibraryStore,
  videoIndex: MutableVideoIndex,
  libraryPath: string,
): Promise<void> {
  videoIndex.replaceVideos(toIndexedVideos(await libraryStore.listVideosWithTags(), libraryPath));
}

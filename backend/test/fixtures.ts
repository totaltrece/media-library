import { join } from "node:path";

import type { IndexedVideo } from "@media-library/indexer";

export const testLibraryPath = "C:\\media-library";

export const testVideos: IndexedVideo[] = [
  {
    videoPath: join(testLibraryPath, "first.mp4"),
    tags: ["salsa", "bea", "linea"],
  },
  {
    videoPath: join(testLibraryPath, "second.mp4"),
    tags: ["salsa", "damian"],
  },
  {
    videoPath: join(testLibraryPath, "third.mp4"),
    tags: ["bachata", "bea"],
  },
];

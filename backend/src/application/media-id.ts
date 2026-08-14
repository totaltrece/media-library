import { relative } from "node:path";

export function toMediaId(videoPath: string, libraryPath: string): string {
  return relative(libraryPath, videoPath).split("\\").join("/");
}

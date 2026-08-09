import { extname } from "node:path";

const contentTypesByExtension = new Map<string, string>([
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".mkv", "video/x-matroska"],
  [".avi", "video/x-msvideo"],
]);

export function contentTypeForVideoPath(videoPath: string): string {
  return contentTypesByExtension.get(extname(videoPath).toLowerCase()) ?? "application/octet-stream";
}

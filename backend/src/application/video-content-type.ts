import { extname } from "node:path";

const contentTypesByExtension = new Map<string, string>([
  [".mp4", "video/mp4"],
  [".m4v", "video/mp4"],
  [".mov", "video/quicktime"],
  [".mkv", "video/x-matroska"],
  [".webm", "video/webm"],
  [".ts", "video/mp2t"],
  [".avi", "video/x-msvideo"],
]);

export function contentTypeForVideoPath(videoPath: string): string {
  return contentTypesByExtension.get(extname(videoPath).toLowerCase()) ?? "application/octet-stream";
}

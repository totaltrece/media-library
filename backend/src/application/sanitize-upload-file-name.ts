import { basename, extname } from "node:path";

export const ALLOWED_UPLOAD_EXTENSIONS = [".mp4", ".m4v", ".mov", ".mkv", ".ts", ".webm"] as const;

export class InvalidUploadFileNameError extends Error {
  constructor(message = "The uploaded video file name is invalid.") {
    super(message);
    this.name = "InvalidUploadFileNameError";
  }
}

/**
 * Accepts only a single path segment. Traversal names are rejected, not rewritten
 * into a workspace path.
 */
export function sanitizeUploadFileName(filename: string): string {
  const trimmed = filename.trim();

  if (trimmed.length === 0) {
    throw new InvalidUploadFileNameError();
  }

  if (trimmed.includes("\0") || trimmed.includes("..") || /[\\/]/.test(trimmed)) {
    throw new InvalidUploadFileNameError();
  }

  const name = basename(trimmed);

  if (name !== trimmed || name === "." || name === "..") {
    throw new InvalidUploadFileNameError();
  }

  const extension = extname(name).toLowerCase();

  if (!ALLOWED_UPLOAD_EXTENSIONS.includes(extension as (typeof ALLOWED_UPLOAD_EXTENSIONS)[number])) {
    throw new InvalidUploadFileNameError("The uploaded video type is not supported.");
  }

  return name;
}

export function isAllowedUploadContentType(contentType: string | undefined): boolean {
  const value = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";

  if (value.length === 0 || value === "application/octet-stream") {
    return true;
  }

  return value.startsWith("video/");
}

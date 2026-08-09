import { resolve, sep } from "node:path";

export function resolveMediaPath(libraryPath: string, mediaId: string): string | undefined {
  const normalizedId = mediaId.split("\\").join("/");

  if (
    normalizedId.length === 0 ||
    normalizedId.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalizedId) ||
    normalizedId.includes("..") ||
    normalizedId.includes("\0")
  ) {
    return undefined;
  }

  const segments = normalizedId.split("/").filter((segment) => segment.length > 0);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return undefined;
  }

  const resolvedLibraryPath = resolve(libraryPath);
  const candidatePath = resolve(resolvedLibraryPath, ...segments);

  if (
    candidatePath !== resolvedLibraryPath &&
    !candidatePath.startsWith(resolvedLibraryPath + sep)
  ) {
    return undefined;
  }

  return candidatePath;
}

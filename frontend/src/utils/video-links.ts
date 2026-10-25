import { buildApiUrl } from "../api/client.js";

const STREAM_PREFIX = "/api/video/";

export function mediaIdFromVideoPath(videoPath: string): string | null {
  const path = videoPath.split(/[?#]/)[0] ?? "";

  if (!path.startsWith(STREAM_PREFIX)) {
    return null;
  }

  const raw = path.slice(STREAM_PREFIX.length);

  if (raw.length === 0) {
    return null;
  }

  try {
    const mediaId = raw
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");

    return mediaId.length > 0 ? mediaId : null;
  } catch {
    return null;
  }
}

export function downloadFileName(videoPath: string): string {
  const mediaId = mediaIdFromVideoPath(videoPath);

  if (mediaId === null) {
    return "video";
  }

  const name = mediaId.split("/").pop() ?? "";

  return name.length > 0 ? name : "video";
}

export function downloadUrlForVideoPath(videoPath: string): string {
  const mediaId = mediaIdFromVideoPath(videoPath);

  if (mediaId === null) {
    const path = buildApiUrl(videoPath.split(/[?#]/)[0] ?? videoPath);
    const separator = path.includes("?") ? "&" : "?";

    return `${path}${separator}download=1`;
  }

  const encoded = mediaId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${STREAM_PREFIX}${encoded}?download=1`;
}

export function absoluteStreamUrl(streamPath: string, origin: string): string {
  return new URL(streamPath, origin).href;
}

import type { ThumbnailGenerationOptions } from "../ports/video-processor.js";

export const DEFAULT_THUMBNAIL_WIDTH = 281;
export const DEFAULT_THUMBNAIL_HEIGHT = 500;
export const DEFAULT_THUMBNAIL_POSITION_RATIO = 0.5;

export function defaultThumbnailGenerationOptions(): ThumbnailGenerationOptions {
  return {
    width: DEFAULT_THUMBNAIL_WIDTH,
    height: DEFAULT_THUMBNAIL_HEIGHT,
    positionRatio: DEFAULT_THUMBNAIL_POSITION_RATIO,
  };
}

export function resolveThumbnailGenerationOptions(
  options?: Partial<ThumbnailGenerationOptions>,
): ThumbnailGenerationOptions {
  const resolved = {
    ...defaultThumbnailGenerationOptions(),
    ...options,
  };

  if (!Number.isInteger(resolved.width) || resolved.width <= 0) {
    throw new Error("Thumbnail width must be a positive integer");
  }

  if (!Number.isInteger(resolved.height) || resolved.height <= 0) {
    throw new Error("Thumbnail height must be a positive integer");
  }

  if (
    typeof resolved.positionRatio !== "number" ||
    Number.isNaN(resolved.positionRatio) ||
    resolved.positionRatio < 0 ||
    resolved.positionRatio > 1
  ) {
    throw new Error("Thumbnail position ratio must be between 0 and 1");
  }

  return resolved;
}

import { dirname, join } from "node:path";

export const DEFAULT_FFMPEG_PATH = "ffmpeg";
export const DEFAULT_FFPROBE_PATH = "ffprobe";
export const DEFAULT_UPLOAD_MAX_BYTES = 512 * 1024 * 1024;

export interface UploadProcessingConfig {
  ffmpegPath: string;
  ffprobePath: string;
  uploadTempPath: string;
  uploadMaxBytes: number;
}

export function resolveUploadProcessingConfig(
  env: NodeJS.Dict<string>,
  options: { sqlitePath: string },
): UploadProcessingConfig {
  return {
    ffmpegPath: readExecutablePath(env.FFMPEG_PATH, DEFAULT_FFMPEG_PATH),
    ffprobePath: readExecutablePath(env.FFPROBE_PATH, DEFAULT_FFPROBE_PATH),
    uploadTempPath: readOptionalPath(env.UPLOAD_TEMP_PATH) ?? join(dirname(options.sqlitePath), "upload-temp"),
    uploadMaxBytes: readPositiveInteger(env.UPLOAD_MAX_BYTES, DEFAULT_UPLOAD_MAX_BYTES, "UPLOAD_MAX_BYTES"),
  };
}

function readExecutablePath(value: string | undefined, fallback: string): string {
  const path = readOptionalPath(value);

  return path ?? fallback;
}

function readOptionalPath(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readPositiveInteger(value: string | undefined, fallback: number, name: string): number {
  const path = readOptionalPath(value);

  if (path === undefined) {
    return fallback;
  }

  const parsed = Number(path);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

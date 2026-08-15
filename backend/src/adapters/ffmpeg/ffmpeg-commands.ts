import type { ThumbnailGenerationOptions } from "../../ports/video-processor.js";

/**
 * Conversion flags taken from tools/convert-hevc-with-thumbnails-and-sync.ps1.
 * Do not change these without updating that script and the upload docs.
 */
export const FFMPEG_H264_VIDEO_CODEC = "libx264";
export const FFMPEG_H264_CRF = "20";
export const FFMPEG_H264_PRESET = "medium";
export const FFMPEG_AAC_AUDIO_CODEC = "aac";
export const FFMPEG_AAC_AUDIO_BITRATE = "128k";
export const FFMPEG_JPEG_QUALITY = "2";
export const FFMPEG_JPEG_STRICT = "unofficial";

export function buildFfprobeArgs(inputPath: string): string[] {
  return ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", "--", inputPath];
}

export function buildFfmpegConvertArgs(inputPath: string, outputPath: string): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a?",
    "-c:v",
    FFMPEG_H264_VIDEO_CODEC,
    "-crf",
    FFMPEG_H264_CRF,
    "-preset",
    FFMPEG_H264_PRESET,
    "-c:a",
    FFMPEG_AAC_AUDIO_CODEC,
    "-b:a",
    FFMPEG_AAC_AUDIO_BITRATE,
    "-map_metadata",
    "0",
    "-movflags",
    "+faststart",
    "-y",
    outputPath,
  ];
}

export function buildFfmpegThumbnailArgs(
  inputPath: string,
  outputPath: string,
  options: ThumbnailGenerationOptions,
  seekSeconds: number,
): string[] {
  return [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    formatSeekSeconds(seekSeconds),
    "-i",
    inputPath,
    "-frames:v",
    "1",
    "-vf",
    buildThumbnailFilter(options),
    "-q:v",
    FFMPEG_JPEG_QUALITY,
    "-strict",
    FFMPEG_JPEG_STRICT,
    "-y",
    outputPath,
  ];
}

export function buildThumbnailFilter(options: ThumbnailGenerationOptions): string {
  const size = `${options.width}:${options.height}`;

  return `scale=${size}:force_original_aspect_ratio=increase,crop=${size}`;
}

export function formatSeekSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0.000";
  }

  return seconds.toFixed(3);
}

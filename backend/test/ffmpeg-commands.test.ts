import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import {
  FFMPEG_AAC_AUDIO_BITRATE,
  FFMPEG_AAC_AUDIO_CODEC,
  FFMPEG_H264_CRF,
  FFMPEG_H264_PRESET,
  FFMPEG_H264_VIDEO_CODEC,
  FFMPEG_JPEG_QUALITY,
  FFMPEG_JPEG_STRICT,
  buildFfmpegConvertArgs,
  buildFfmpegThumbnailArgs,
  buildFfprobeArgs,
  buildThumbnailFilter,
  formatSeekSeconds,
} from "../src/adapters/ffmpeg/ffmpeg-commands.js";
import { defaultThumbnailGenerationOptions } from "../src/application/thumbnail-generation-options.js";

test("ffprobe and ffmpeg command builders pass paths as single arguments without a shell", () => {
  const inputPath = join("C:", "My Videos", "clip 01.mp4");
  const outputPath = join("upload temp", "job 1", "converted.mp4");
  const thumbnailPath = join("upload temp", "job 1", "thumbnail.jpg");
  const probeArgs = buildFfprobeArgs(inputPath);
  const convertArgs = buildFfmpegConvertArgs(inputPath, outputPath);
  const thumbnailArgs = buildFfmpegThumbnailArgs(
    inputPath,
    thumbnailPath,
    defaultThumbnailGenerationOptions(),
    1.5,
  );

  assert.equal(probeArgs.at(-1), inputPath);
  assert.equal(probeArgs.at(-2), "--");
  assert.equal(convertArgs[convertArgs.indexOf("-i") + 1], inputPath);
  assert.equal(convertArgs.at(-1), outputPath);
  assert.equal(thumbnailArgs[thumbnailArgs.indexOf("-i") + 1], inputPath);
  assert.equal(thumbnailArgs.at(-1), thumbnailPath);

  for (const args of [probeArgs, convertArgs, thumbnailArgs]) {
    assert.equal(
      args.some((arg) => arg.includes("&&") || arg.includes("|") || arg.startsWith('"')),
      false,
    );
  }
});

test("convert args match the PowerShell HEVC to H.264 flags", () => {
  const args = buildFfmpegConvertArgs("in.mp4", "out.converting.mp4");

  assert.deepEqual(args, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-progress",
    "pipe:1",
    "-i",
    "in.mp4",
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
    "out.converting.mp4",
  ]);
  assert.equal(FFMPEG_H264_VIDEO_CODEC, "libx264");
  assert.equal(FFMPEG_H264_CRF, "20");
  assert.equal(FFMPEG_H264_PRESET, "medium");
  assert.equal(FFMPEG_AAC_AUDIO_CODEC, "aac");
  assert.equal(FFMPEG_AAC_AUDIO_BITRATE, "128k");
});

test("thumbnail args match the PowerShell scale/crop JPEG flags", () => {
  const options = defaultThumbnailGenerationOptions();
  const args = buildFfmpegThumbnailArgs("converted.mp4", "thumb.generating.jpg", options, 12.5);

  assert.equal(buildThumbnailFilter(options), "scale=281:500:force_original_aspect_ratio=increase,crop=281:500");
  assert.equal(args[args.indexOf("-ss") + 1], "12.500");
  assert.equal(args[args.indexOf("-frames:v") + 1], "1");
  assert.equal(args[args.indexOf("-vf") + 1], "scale=281:500:force_original_aspect_ratio=increase,crop=281:500");
  assert.equal(args[args.indexOf("-q:v") + 1], FFMPEG_JPEG_QUALITY);
  assert.equal(args[args.indexOf("-strict") + 1], FFMPEG_JPEG_STRICT);
  assert.equal(FFMPEG_JPEG_QUALITY, "2");
  assert.equal(FFMPEG_JPEG_STRICT, "unofficial");
  assert.equal(formatSeekSeconds(Number.NaN), "0.000");
});

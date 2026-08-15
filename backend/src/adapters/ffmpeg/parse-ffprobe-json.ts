import type { VideoProbeResult } from "../../ports/video-processor.js";

export function parseFfprobeJson(stdout: string): VideoProbeResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("ffprobe returned invalid JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("ffprobe JSON must be an object");
  }

  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const videoStream = streams.find((stream) => isRecord(stream) && stream.codec_type === "video");

  if (!isRecord(videoStream)) {
    throw new Error("ffprobe did not report a video stream");
  }

  const width = readPositiveInteger(videoStream.width, "width");
  const height = readPositiveInteger(videoStream.height, "height");
  const format = isRecord(parsed.format) ? parsed.format : undefined;
  const durationSeconds = readDuration(format?.duration) ?? readDuration(videoStream.duration);

  if (durationSeconds === undefined) {
    throw new Error("ffprobe did not report a duration");
  }

  const audioStream = streams.find((stream) => isRecord(stream) && stream.codec_type === "audio");

  return {
    durationSeconds,
    width,
    height,
    videoCodec: readOptionalCodec(videoStream.codec_name),
    audioCodec: isRecord(audioStream) ? readOptionalCodec(audioStream.codec_name) : null,
  };
}

function readOptionalCodec(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const codec = value.trim().toLowerCase();

  return codec.length > 0 ? codec : null;
}

function readPositiveInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`ffprobe did not report a valid ${name}`);
  }

  return value;
}

function readDuration(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());

    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

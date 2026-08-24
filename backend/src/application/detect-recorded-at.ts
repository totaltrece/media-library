import { stat } from "node:fs/promises";

import type { VideoProcessor } from "../ports/video-processor.js";

import { recordedAtFromFileName } from "./filename-recorded-at-fallback.js";
import { resolveLibraryVideoPath } from "./library-media-paths.js";
import { toStoredRecordedAt } from "./resolve-canonical-upload-name.js";

export type RecordedAtSource = "ffprobe" | "filename-fallback" | "none";

export interface DetectedRecordedAt {
  detected: string | null;
  source: RecordedAtSource;
}

export async function detectRecordedAt(
  videoId: string,
  libraryPath: string,
  processor: VideoProcessor,
): Promise<DetectedRecordedAt> {
  const videoPath = resolveLibraryVideoPath(libraryPath, videoId);

  if (videoPath === undefined) {
    throw new Error(`Invalid media id: ${videoId}`);
  }

  const file = await stat(videoPath);

  if (!file.isFile()) {
    throw new Error(`Library path is not a file: ${videoId}`);
  }

  const probe = await processor.probe(videoPath);
  const fromProbe = toStoredRecordedAt(probe.recordingTime);

  if (fromProbe !== null) {
    return { detected: fromProbe, source: "ffprobe" };
  }

  const fromName = recordedAtFromFileName(videoId);

  if (fromName !== null) {
    return { detected: fromName, source: "filename-fallback" };
  }

  return { detected: null, source: "none" };
}

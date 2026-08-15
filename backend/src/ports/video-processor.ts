export interface VideoProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string | null;
  audioCodec: string | null;
}

export interface ThumbnailGenerationOptions {
  width: number;
  height: number;
  /**
   * Frame position as a fraction of the video duration.
   * `0` is the start; `1` is the end.
   */
  positionRatio: number;
}

/**
 * Converts and inspects video files. Paths are filesystem locations, not media ids.
 * The FFmpeg adapter is introduced in a later milestone.
 */
export interface VideoProcessor {
  probe(inputPath: string): Promise<VideoProbeResult>;
  convert(inputPath: string, outputPath: string): Promise<void>;
  generateThumbnail(
    inputPath: string,
    outputPath: string,
    options?: Partial<ThumbnailGenerationOptions>,
  ): Promise<void>;
}

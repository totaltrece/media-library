/**
 * Only HEVC is converted. H.264 and any other codec keep the staged source.
 * VideoProcessor.convert always converts when called; this decides whether to call it.
 */
export function needsH264Conversion(videoCodec: string | null): boolean {
  return videoCodec === "hevc";
}

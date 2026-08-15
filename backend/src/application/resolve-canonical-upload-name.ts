import { extname } from "node:path";

/**
 * Same YYYYMMDD segment used by the frontend overlay (`formatVideoDateFromName`).
 * A filename that matches can supply the library date without probing metadata.
 */
export const VIDEO_DATE_IN_NAME_PATTERN = /(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/;

const CANONICAL_PXL_NAME_PATTERN = /^PXL_\d{8}_\d{9}\.[^.]+$/;
const MIN_RELIABLE_UTC_YEAR = 2000;
const MAX_RELIABLE_UTC_YEAR = 2100;

export function filenameHasVideoDate(name: string): boolean {
  return VIDEO_DATE_IN_NAME_PATTERN.test(name);
}

export function isCanonicalPxlFileName(name: string): boolean {
  return CANONICAL_PXL_NAME_PATTERN.test(name);
}

/**
 * Parses an ffprobe creation timestamp. Returns null when the value is missing,
 * unparseable, or not a plausible recording date (for example Unix epoch).
 */
export function parseRecordingTime(value: string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const recordedAt = new Date(normalizeTimestamp(trimmed));

  if (!Number.isFinite(recordedAt.getTime())) {
    return null;
  }

  const year = recordedAt.getUTCFullYear();

  if (year < MIN_RELIABLE_UTC_YEAR || year > MAX_RELIABLE_UTC_YEAR) {
    return null;
  }

  return recordedAt;
}

export function toCanonicalPxlFileName(recordedAt: Date, extension: string): string {
  const ext = normalizeExtension(extension);
  const stamp =
    `${recordedAt.getFullYear()}` +
    pad(recordedAt.getMonth() + 1, 2) +
    pad(recordedAt.getDate(), 2) +
    "_" +
    pad(recordedAt.getHours(), 2) +
    pad(recordedAt.getMinutes(), 2) +
    pad(recordedAt.getSeconds(), 2) +
    pad(recordedAt.getMilliseconds(), 3);

  return `PXL_${stamp}${ext}`;
}

/**
 * Library video id for an upload. Names that already contain a YYYYMMDD date
 * (including `PXL_YYYYMMDD_HHMMSSmmm`) are kept. Otherwise a reliable recording
 * timestamp is formatted as the canonical Pixel name. If metadata has no usable
 * date, the sanitized original name is kept — a date is never invented.
 */
export function resolveCanonicalUploadName(
  originalName: string,
  recordingTime: string | null | undefined,
): string {
  if (filenameHasVideoDate(originalName)) {
    return originalName;
  }

  const recordedAt = parseRecordingTime(recordingTime);

  if (recordedAt === null) {
    return originalName;
  }

  return toCanonicalPxlFileName(recordedAt, extname(originalName));
}

function normalizeExtension(extension: string): string {
  const trimmed = extension.trim();

  if (trimmed.length === 0) {
    return ".mp4";
  }

  return trimmed.startsWith(".") ? trimmed.toLowerCase() : `.${trimmed.toLowerCase()}`;
}

function normalizeTimestamp(value: string): string {
  const truncatedFraction = value.replace(/(\.\d{3})\d+/, "$1");
  return truncatedFraction.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, "0");
}

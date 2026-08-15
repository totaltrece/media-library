import { posix } from "node:path";

import { VIDEO_DATE_IN_NAME_PATTERN } from "./resolve-canonical-upload-name.js";

/**
 * Backfill-only fallback when ffprobe has no reliable recording date.
 * New uploads must not use this: they store `recorded_at` from video metadata.
 *
 * Uses the first valid YYYYMMDD in the basename. The calendar day is known;
 * the time is conventional (20:00 Europe/Madrid).
 */
export const FILENAME_FALLBACK_TIME_ZONE = "Europe/Madrid";
export const FILENAME_FALLBACK_HOUR = 20;

const MIN_RELIABLE_YEAR = 2000;
const MAX_RELIABLE_YEAR = 2100;

export function recordedAtFromFileName(videoId: string): string | null {
  const name = posix.basename(videoId.replaceAll("\\", "/"));
  const calendarDate = firstCalendarDateInName(name);

  if (calendarDate === null) {
    return null;
  }

  const recordedAt = zonedLocalTimeToUtc(FILENAME_FALLBACK_TIME_ZONE, {
    ...calendarDate,
    hour: FILENAME_FALLBACK_HOUR,
    minute: 0,
    second: 0,
  });

  return recordedAt === null ? null : recordedAt.toISOString();
}

function firstCalendarDateInName(name: string): { year: number; month: number; day: number } | null {
  const matches = name.matchAll(new RegExp(VIDEO_DATE_IN_NAME_PATTERN.source, "g"));

  for (const match of matches) {
    const calendarDate = parseCalendarDate(match[0]);

    if (calendarDate !== null) {
      return calendarDate;
    }
  }

  return null;
}

function parseCalendarDate(yyyymmdd: string): { year: number; month: number; day: number } | null {
  const year = Number(yyyymmdd.slice(0, 4));
  const month = Number(yyyymmdd.slice(4, 6));
  const day = Number(yyyymmdd.slice(6, 8));

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  if (year < MIN_RELIABLE_YEAR || year > MAX_RELIABLE_YEAR) {
    return null;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));

  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }

  return { year, month, day };
}

function zonedLocalTimeToUtc(
  timeZone: string,
  local: { year: number; month: number; day: number; hour: number; minute: number; second: number },
): Date | null {
  const utcMillis = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  const firstPass = new Date(utcMillis - timeZoneOffsetMs(new Date(utcMillis), timeZone));
  const instant = new Date(utcMillis - timeZoneOffsetMs(firstPass, timeZone));
  const parts = zonedDateTimeParts(instant, timeZone);

  if (
    parts.year !== local.year ||
    parts.month !== local.month ||
    parts.day !== local.day ||
    parts.hour !== local.hour ||
    parts.minute !== local.minute ||
    parts.second !== local.second
  ) {
    return null;
  }

  return instant;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = zonedDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function zonedDateTimeParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

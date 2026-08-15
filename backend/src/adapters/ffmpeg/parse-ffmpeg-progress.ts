const OUT_TIME_US = /^out_time_us=(-?\d+|N\/A)$/;
const OUT_TIME_MS = /^out_time_ms=(-?\d+|N\/A)$/;
const OUT_TIME = /^out_time=(-?\d+:\d+:\d+(?:\.\d+)?|N\/A)$/;

export function parseFfmpegOutTimeSeconds(line: string): number | null {
  const trimmed = line.trim();

  const microseconds = OUT_TIME_US.exec(trimmed);

  if (microseconds) {
    return parseNumericTime(microseconds[1], 1_000_000);
  }

  const milliseconds = OUT_TIME_MS.exec(trimmed);

  if (milliseconds) {
    return parseNumericTime(milliseconds[1], 1_000);
  }

  const clock = OUT_TIME.exec(trimmed);

  if (clock) {
    return parseClockTime(clock[1] ?? "");
  }

  return null;
}

function parseNumericTime(value: string | undefined, divisor: number): number | null {
  if (value === undefined || value === "N/A") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed / divisor;
}

function parseClockTime(value: string): number | null {
  if (value === "N/A") {
    return null;
  }

  const parts = value.split(":");

  if (parts.length !== 3) {
    return null;
  }

  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  const seconds = Number(parts[2]);

  if (![hours, minutes, seconds].every((part) => Number.isFinite(part))) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

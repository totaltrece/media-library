export function clampConversionProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

export function conversionProgressPercent(outTimeSeconds: number, durationSeconds: number): number {
  if (!Number.isFinite(outTimeSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }

  return clampConversionProgress((outTimeSeconds / durationSeconds) * 100);
}

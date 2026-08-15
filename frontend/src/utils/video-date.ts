export type DateSortDirection = "asc" | "desc";

export function formatVideoDate(recordedAt: string | null | undefined): string | null {
  if (recordedAt == null) {
    return null;
  }

  const trimmed = recordedAt.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const recorded = new Date(trimmed);

  if (!Number.isFinite(recorded.getTime())) {
    return null;
  }

  const day = String(recorded.getDate()).padStart(2, "0");
  const month = String(recorded.getMonth() + 1).padStart(2, "0");
  const year = String(recorded.getFullYear());

  return `${day} ${month} ${year}`;
}

export function sortVideosByRecordedAt<T extends { id: string; recordedAt: string | null }>(
  videos: readonly T[],
  direction: DateSortDirection,
): T[] {
  return [...videos].sort((first, second) => {
    const firstTime = recordedAtTime(first.recordedAt);
    const secondTime = recordedAtTime(second.recordedAt);

    if (firstTime === null && secondTime === null) {
      return first.id.localeCompare(second.id);
    }

    if (firstTime === null) {
      return 1;
    }

    if (secondTime === null) {
      return -1;
    }

    if (firstTime !== secondTime) {
      return direction === "asc" ? firstTime - secondTime : secondTime - firstTime;
    }

    return first.id.localeCompare(second.id);
  });
}

function recordedAtTime(recordedAt: string | null): number | null {
  if (recordedAt == null) {
    return null;
  }

  const trimmed = recordedAt.trim();

  if (trimmed.length === 0) {
    return null;
  }

  const time = Date.parse(trimmed);
  return Number.isFinite(time) ? time : null;
}

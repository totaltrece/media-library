import { describe, expect, it } from "vitest";

import { formatVideoDate, sortVideosByRecordedAt } from "../src/utils/video-date.js";
import type { SearchResultItem } from "../src/api/types.js";

describe("formatVideoDate", () => {
  it("formats recorded_at as DD MM YYYY", () => {
    const recordedAt = new Date(2026, 2, 14, 20, 4, 31, 123).toISOString();
    expect(formatVideoDate(recordedAt)).toBe("14 03 2026");
  });

  it("does not use a filename and hides missing or invalid dates", () => {
    expect(formatVideoDate(null)).toBeNull();
    expect(formatVideoDate(undefined)).toBeNull();
    expect(formatVideoDate("")).toBeNull();
    expect(formatVideoDate("PXL_20260314_200431123.mp4")).toBeNull();
    expect(formatVideoDate("not-a-date")).toBeNull();
  });
});

describe("sortVideosByRecordedAt", () => {
  const videos: SearchResultItem[] = [
    video("new.mp4", "2026-03-14T19:00:00.000Z"),
    video("old.mp4", "2024-10-16T18:00:00.000Z"),
    video("none.mp4", null),
    video("mid.mp4", "2025-12-27T19:00:00.000Z"),
  ];

  it("sorts oldest first and keeps videos without a date at the end", () => {
    expect(sortVideosByRecordedAt(videos, "asc").map((item) => item.id)).toEqual([
      "old.mp4",
      "mid.mp4",
      "new.mp4",
      "none.mp4",
    ]);
  });

  it("sorts newest first and keeps videos without a date at the end", () => {
    expect(sortVideosByRecordedAt(videos, "desc").map((item) => item.id)).toEqual([
      "new.mp4",
      "mid.mp4",
      "old.mp4",
      "none.mp4",
    ]);
  });
});

function video(id: string, recordedAt: string | null): SearchResultItem {
  return {
    id,
    name: id,
    thumbnail: `/api/thumbnail/${id}`,
    video: `/api/video/${id}`,
    tags: [],
    recordedAt,
  };
}

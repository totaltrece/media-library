import { describe, expect, it } from "vitest";

import { formatVideoDateFromName, VIDEO_DATE_PLACEHOLDER } from "../src/utils/video-date.js";

describe("formatVideoDateFromName", () => {
  it("formats a YYYYMMDD segment as DD MM YYYY", () => {
    expect(formatVideoDateFromName("20250630_193642391.TS.mp4")).toBe("30 06 2025");
    expect(formatVideoDateFromName("PXL_20260130_200612818.TS.mp4")).toBe("30 01 2026");
  });

  it("returns a placeholder when the filename has no valid date segment", () => {
    expect(formatVideoDateFromName("salsa/first.mp4")).toBe(VIDEO_DATE_PLACEHOLDER);
    expect(formatVideoDateFromName("video-without-date.mp4")).toBe(VIDEO_DATE_PLACEHOLDER);
  });
});

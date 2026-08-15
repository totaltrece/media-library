import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filenameHasVideoDate,
  isCanonicalPxlFileName,
  parseRecordingTime,
  resolveCanonicalUploadName,
  toCanonicalPxlFileName,
} from "../src/application/resolve-canonical-upload-name.js";

test("filenameHasVideoDate accepts Pixel and dated library names", () => {
  assert.equal(filenameHasVideoDate("PXL_20260314_200431123.mp4"), true);
  assert.equal(filenameHasVideoDate("PXL_20260130_200612818.TS.mp4"), true);
  assert.equal(filenameHasVideoDate("20250630_193642391.TS.mp4"), true);
});

test("filenameHasVideoDate rejects Android MediaStore and undated names", () => {
  assert.equal(filenameHasVideoDate("1000141506.mp4"), false);
  assert.equal(filenameHasVideoDate("clip.mp4"), false);
  assert.equal(filenameHasVideoDate("PXL_clip.mp4"), false);
});

test("toCanonicalPxlFileName uses the existing PXL_YYYYMMDD_HHMMSSmmm format", () => {
  const recordedAt = new Date(2026, 2, 14, 20, 4, 31, 123);
  const name = toCanonicalPxlFileName(recordedAt, ".mp4");

  assert.equal(name, "PXL_20260314_200431123.mp4");
  assert.equal(isCanonicalPxlFileName(name), true);
  assert.match(name, /^PXL_\d{8}_\d{9}\.mp4$/);
});

test("toCanonicalPxlFileName pads missing milliseconds to three digits", () => {
  const recordedAt = new Date(2026, 2, 14, 20, 4, 31, 5);
  assert.equal(toCanonicalPxlFileName(recordedAt, ".mp4"), "PXL_20260314_200431005.mp4");
});

test("resolveCanonicalUploadName keeps a valid PXL name even when metadata exists", () => {
  assert.equal(
    resolveCanonicalUploadName("PXL_20260314_200431123.mp4", "2020-01-01T00:00:00.000Z"),
    "PXL_20260314_200431123.mp4",
  );
});

test("resolveCanonicalUploadName builds a canonical PXL name from metadata for MediaStore names", () => {
  const iso = "2026-03-14T19:04:31.123Z";
  const expected = toCanonicalPxlFileName(new Date(iso), ".mp4");

  assert.equal(resolveCanonicalUploadName("1000141506.mp4", iso), expected);
  assert.equal(isCanonicalPxlFileName(expected), true);
});

test("resolveCanonicalUploadName keeps the original name when metadata has no reliable date", () => {
  assert.equal(resolveCanonicalUploadName("1000141506.mp4", null), "1000141506.mp4");
  assert.equal(resolveCanonicalUploadName("1000141506.mp4", undefined), "1000141506.mp4");
  assert.equal(resolveCanonicalUploadName("1000141506.mp4", ""), "1000141506.mp4");
  assert.equal(resolveCanonicalUploadName("1000141506.mp4", "not-a-date"), "1000141506.mp4");
  assert.equal(resolveCanonicalUploadName("1000141506.mp4", "1970-01-01T00:00:00.000000Z"), "1000141506.mp4");
  assert.equal(filenameHasVideoDate("1000141506.mp4"), false);
});

test("parseRecordingTime accepts ISO timestamps and rejects epoch or invalid values", () => {
  const parsed = parseRecordingTime("2026-03-14T19:04:31.123000Z");
  assert.ok(parsed instanceof Date);
  assert.equal(parsed.getTime(), Date.parse("2026-03-14T19:04:31.123Z"));

  const withOffset = parseRecordingTime("2026-03-14T20:04:31+0100");
  assert.ok(withOffset instanceof Date);

  assert.equal(parseRecordingTime(null), null);
  assert.equal(parseRecordingTime("   "), null);
  assert.equal(parseRecordingTime("yesterday"), null);
  assert.equal(parseRecordingTime("1970-01-01T00:00:00.000000Z"), null);
});

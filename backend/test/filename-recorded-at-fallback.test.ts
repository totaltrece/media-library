import assert from "node:assert/strict";
import { test } from "node:test";

import { recordedAtFromFileName } from "../src/application/filename-recorded-at-fallback.js";

test("filename fallback converts a YYYYMMDD name at 20:00 Europe/Madrid to UTC", () => {
  assert.equal(recordedAtFromFileName("VID-20251227-WA0005.mp4"), "2025-12-27T19:00:00.000Z");
  assert.equal(recordedAtFromFileName("VID-20260101-WA0013.mp4"), "2026-01-01T19:00:00.000Z");
  assert.equal(recordedAtFromFileName("20241016-WA0010-mariposas.mp4"), "2024-10-16T18:00:00.000Z");
});

test("filename fallback uses CEST in summer", () => {
  assert.equal(recordedAtFromFileName("VID-20260715-WA0001.mp4"), "2026-07-15T18:00:00.000Z");
  assert.equal(recordedAtFromFileName("PXL_20260813_213639202.TS.mp4"), "2026-08-13T18:00:00.000Z");
});

test("filename fallback rejects an invalid calendar date", () => {
  assert.equal(recordedAtFromFileName("VID-20250230-WA0001.mp4"), null);
  assert.equal(recordedAtFromFileName("20251301-mariposas.mp4"), null);
  assert.equal(recordedAtFromFileName("clip-20251131.mp4"), null);
});

test("filename fallback ignores names without a valid YYYYMMDD date", () => {
  assert.equal(recordedAtFromFileName("clip.mp4"), null);
  assert.equal(recordedAtFromFileName("WA0010-mariposas.mp4"), null);
  assert.equal(recordedAtFromFileName("1000141506.mp4"), null);
});

test("filename fallback matches nested library ids by basename", () => {
  assert.equal(
    recordedAtFromFileName("whatsapp/20241016-WA0010-mariposas.mp4"),
    "2024-10-16T18:00:00.000Z",
  );
});

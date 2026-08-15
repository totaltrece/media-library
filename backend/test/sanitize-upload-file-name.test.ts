import assert from "node:assert/strict";
import { test } from "node:test";

import {
  InvalidUploadFileNameError,
  isAllowedUploadContentType,
  sanitizeUploadFileName,
} from "../src/application/sanitize-upload-file-name.js";

test("sanitizeUploadFileName accepts a simple video file name", () => {
  assert.equal(sanitizeUploadFileName("PXL_20260813_214135367.TS.mp4"), "PXL_20260813_214135367.TS.mp4");
});

test("sanitizeUploadFileName rejects traversal and unsupported types", () => {
  assert.throws(() => sanitizeUploadFileName("../../archivo.mp4"), InvalidUploadFileNameError);
  assert.throws(() => sanitizeUploadFileName(String.raw`..\..\archivo.mp4`), InvalidUploadFileNameError);
  assert.throws(() => sanitizeUploadFileName("folder/clip.mp4"), InvalidUploadFileNameError);
  assert.throws(() => sanitizeUploadFileName("clip.exe"), InvalidUploadFileNameError);
  assert.throws(() => sanitizeUploadFileName(""), InvalidUploadFileNameError);
});

test("isAllowedUploadContentType accepts video and opaque octet streams", () => {
  assert.equal(isAllowedUploadContentType("video/mp4"), true);
  assert.equal(isAllowedUploadContentType("application/octet-stream"), true);
  assert.equal(isAllowedUploadContentType("image/jpeg"), false);
  assert.equal(isAllowedUploadContentType("text/plain"), false);
});

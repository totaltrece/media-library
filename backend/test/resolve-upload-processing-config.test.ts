import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import {
  DEFAULT_FFMPEG_PATH,
  DEFAULT_FFPROBE_PATH,
  DEFAULT_UPLOAD_MAX_BYTES,
  resolveUploadProcessingConfig,
} from "../src/application/resolve-upload-processing-config.js";

test("resolveUploadProcessingConfig uses PATH names and a temp directory next to SQLite", () => {
  assert.deepEqual(
    resolveUploadProcessingConfig({}, { sqlitePath: join("data", "library.sqlite") }),
    {
      ffmpegPath: DEFAULT_FFMPEG_PATH,
      ffprobePath: DEFAULT_FFPROBE_PATH,
      uploadTempPath: join("data", "upload-temp"),
      uploadMaxBytes: DEFAULT_UPLOAD_MAX_BYTES,
    },
  );
});

test("resolveUploadProcessingConfig preserves configured executable paths on Windows and Ubuntu", () => {
  assert.equal(
    resolveUploadProcessingConfig(
      { FFMPEG_PATH: String.raw`C:\ffmpeg\bin\ffmpeg.exe`, FFPROBE_PATH: String.raw`C:\ffmpeg\bin\ffprobe.exe` },
      { sqlitePath: join("data", "library.sqlite") },
    ).ffmpegPath,
    String.raw`C:\ffmpeg\bin\ffmpeg.exe`,
  );
  assert.equal(
    resolveUploadProcessingConfig(
      { FFMPEG_PATH: "/usr/bin/ffmpeg", FFPROBE_PATH: "/usr/bin/ffprobe" },
      { sqlitePath: join("data", "library.sqlite") },
    ).ffprobePath,
    "/usr/bin/ffprobe",
  );
  assert.equal(
    resolveUploadProcessingConfig(
      { UPLOAD_TEMP_PATH: "   D:\\media\\tmp   ", UPLOAD_MAX_BYTES: "1048576" },
      { sqlitePath: join("data", "library.sqlite") },
    ).uploadTempPath,
    String.raw`D:\media\tmp`,
  );
});

test("resolveUploadProcessingConfig rejects an invalid size limit", () => {
  assert.throws(
    () => resolveUploadProcessingConfig({ UPLOAD_MAX_BYTES: "0" }, { sqlitePath: join("data", "library.sqlite") }),
    /UPLOAD_MAX_BYTES must be a positive integer/,
  );
});

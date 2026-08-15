import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFfmpegOutTimeSeconds } from "../src/adapters/ffmpeg/parse-ffmpeg-progress.js";

test("parseFfmpegOutTimeSeconds reads microseconds, milliseconds, and clock time", () => {
  assert.equal(parseFfmpegOutTimeSeconds("out_time_us=5000000"), 5);
  assert.equal(parseFfmpegOutTimeSeconds("out_time_ms=2500"), 2.5);
  assert.equal(parseFfmpegOutTimeSeconds("out_time=00:00:04.500"), 4.5);
  assert.equal(parseFfmpegOutTimeSeconds("out_time_us=N/A"), null);
  assert.equal(parseFfmpegOutTimeSeconds("out_time=N/A"), null);
  assert.equal(parseFfmpegOutTimeSeconds("frame=12"), null);
});

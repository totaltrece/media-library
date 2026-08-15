import assert from "node:assert/strict";
import { test } from "node:test";

import { parseFfprobeJson } from "../src/adapters/ffmpeg/parse-ffprobe-json.js";

test("parseFfprobeJson reads codec, duration, and resolution from JSON", () => {
  assert.deepEqual(
    parseFfprobeJson(
      JSON.stringify({
        streams: [
          { codec_type: "video", codec_name: "HEVC", width: 1920, height: 1080, duration: "3.2" },
          { codec_type: "audio", codec_name: "aac" },
        ],
        format: { duration: "4.5" },
      }),
    ),
    {
      durationSeconds: 4.5,
      width: 1920,
      height: 1080,
      videoCodec: "hevc",
      audioCodec: "aac",
    },
  );
});

test("parseFfprobeJson falls back to stream duration and allows missing audio", () => {
  assert.deepEqual(
    parseFfprobeJson(
      JSON.stringify({
        streams: [{ codec_type: "video", codec_name: "h264", width: 640, height: 360, duration: "1" }],
      }),
    ),
    {
      durationSeconds: 1,
      width: 640,
      height: 360,
      videoCodec: "h264",
      audioCodec: null,
    },
  );
});

test("parseFfprobeJson rejects invalid payloads", () => {
  assert.throws(() => parseFfprobeJson("not-json"), /invalid JSON/);
  assert.throws(() => parseFfprobeJson("{}"), /video stream/);
  assert.throws(
    () => parseFfprobeJson(JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: 0, height: 1 }] })),
    /valid width/,
  );
  assert.throws(
    () => parseFfprobeJson(JSON.stringify({ streams: [{ codec_type: "video", codec_name: "h264", width: 8, height: 8 }] })),
    /duration/,
  );
});

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
      recordingTime: null,
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
      recordingTime: null,
    },
  );
});

test("parseFfprobeJson reads creation_time from format tags", () => {
  assert.equal(
    parseFfprobeJson(
      JSON.stringify({
        streams: [{ codec_type: "video", codec_name: "h264", width: 1080, height: 1920, duration: "1" }],
        format: {
          duration: "1",
          tags: { creation_time: "2026-03-14T19:04:31.123000Z", "com.android.version": "16" },
        },
      }),
    ).recordingTime,
    "2026-03-14T19:04:31.123000Z",
  );
});

test("parseFfprobeJson prefers format creation_time over stream tags", () => {
  assert.equal(
    parseFfprobeJson(
      JSON.stringify({
        streams: [{
          codec_type: "video",
          codec_name: "h264",
          width: 8,
          height: 8,
          duration: "1",
          tags: { creation_time: "2020-01-01T00:00:00.000000Z" },
        }],
        format: { duration: "1", tags: { creation_time: "2026-03-14T19:04:31.000000Z" } },
      }),
    ).recordingTime,
    "2026-03-14T19:04:31.000000Z",
  );
});

test("parseFfprobeJson falls back to QuickTime and video stream creation tags", () => {
  assert.equal(
    parseFfprobeJson(
      JSON.stringify({
        streams: [{ codec_type: "video", codec_name: "h264", width: 8, height: 8, duration: "1" }],
        format: { duration: "1", tags: { "com.apple.quicktime.creationdate": "2026-03-14T20:04:31+0100" } },
      }),
    ).recordingTime,
    "2026-03-14T20:04:31+0100",
  );

  assert.equal(
    parseFfprobeJson(
      JSON.stringify({
        streams: [{
          codec_type: "video",
          codec_name: "h264",
          width: 8,
          height: 8,
          duration: "1",
          tags: { creation_time: "2026-03-14T19:04:31.000000Z" },
        }],
        format: { duration: "1" },
      }),
    ).recordingTime,
    "2026-03-14T19:04:31.000000Z",
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

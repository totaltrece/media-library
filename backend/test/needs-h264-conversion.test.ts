import assert from "node:assert/strict";
import { test } from "node:test";

import { needsH264Conversion } from "../src/application/needs-h264-conversion.js";

test("needsH264Conversion is true only for HEVC", () => {
  assert.equal(needsH264Conversion("hevc"), true);
  assert.equal(needsH264Conversion("h264"), false);
  assert.equal(needsH264Conversion("mpeg4"), false);
  assert.equal(needsH264Conversion("vp9"), false);
  assert.equal(needsH264Conversion(null), false);
});

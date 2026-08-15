import assert from "node:assert/strict";
import { test } from "node:test";

import { clampConversionProgress, conversionProgressPercent } from "../src/application/conversion-progress.js";

test("clampConversionProgress keeps values between 0 and 100", () => {
  assert.equal(clampConversionProgress(0), 0);
  assert.equal(clampConversionProgress(47.4), 47);
  assert.equal(clampConversionProgress(47.5), 48);
  assert.equal(clampConversionProgress(100), 100);
  assert.equal(clampConversionProgress(150), 100);
  assert.equal(clampConversionProgress(-10), 0);
  assert.equal(clampConversionProgress(Number.NaN), 0);
});

test("conversionProgressPercent is out_time divided by duration", () => {
  assert.equal(conversionProgressPercent(0, 10), 0);
  assert.equal(conversionProgressPercent(4.7, 10), 47);
  assert.equal(conversionProgressPercent(10, 10), 100);
  assert.equal(conversionProgressPercent(12, 10), 100);
  assert.equal(conversionProgressPercent(5, 0), 0);
});

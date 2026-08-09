import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRangeHeader } from "../src/application/parse-range-header.js";

test("parseRangeHeader returns full when Range header is absent", () => {
  assert.deepEqual(parseRangeHeader(undefined, 100), { kind: "full" });
});

test("parseRangeHeader parses a closed byte range", () => {
  assert.deepEqual(parseRangeHeader("bytes=0-4", 10), {
    kind: "partial",
    range: { start: 0, end: 4 },
  });
});

test("parseRangeHeader parses an open-ended byte range", () => {
  assert.deepEqual(parseRangeHeader("bytes=5-", 10), {
    kind: "partial",
    range: { start: 5, end: 9 },
  });
});

test("parseRangeHeader parses a suffix byte range", () => {
  assert.deepEqual(parseRangeHeader("bytes=-3", 10), {
    kind: "partial",
    range: { start: 7, end: 9 },
  });
});

test("parseRangeHeader returns unsatisfiable for invalid range syntax", () => {
  assert.deepEqual(parseRangeHeader("invalid", 10), { kind: "unsatisfiable" });
  assert.deepEqual(parseRangeHeader("bytes=-", 10), { kind: "unsatisfiable" });
});

test("parseRangeHeader returns unsatisfiable when the range starts beyond the file", () => {
  assert.deepEqual(parseRangeHeader("bytes=10-20", 10), { kind: "unsatisfiable" });
});

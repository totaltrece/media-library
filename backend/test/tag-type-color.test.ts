import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeTagTypeColor } from "../src/application/tag-type-color.js";

test("normalizeTagTypeColor accepts hex colors and expands shorthand", () => {
  assert.equal(normalizeTagTypeColor("#93C5FD"), "#93c5fd");
  assert.equal(normalizeTagTypeColor("  #abc  "), "#aabbcc");
  assert.equal(normalizeTagTypeColor("red"), null);
  assert.equal(normalizeTagTypeColor("#gg0000"), null);
});

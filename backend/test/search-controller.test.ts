import assert from "node:assert/strict";
import { test } from "node:test";

import { parseTagQuery } from "../src/adapters/http/search-controller.js";

test("parseTagQuery returns an empty array when tag is absent", () => {
  assert.deepEqual(parseTagQuery({}), []);
  assert.deepEqual(parseTagQuery(undefined), []);
});

test("parseTagQuery preserves a single tag exactly as received", () => {
  assert.deepEqual(parseTagQuery({ tag: "SALSA" }), ["SALSA"]);
});

test("parseTagQuery preserves repeated tag values exactly as received", () => {
  assert.deepEqual(parseTagQuery({ tag: ["salsa", "bea"] }), ["salsa", "bea"]);
});

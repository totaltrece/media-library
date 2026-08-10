import assert from "node:assert/strict";
import { resolve, sep } from "node:path";
import { test } from "node:test";

import { resolveMediaPath } from "../src/application/resolve-media-id.js";

const libraryPath = resolve("C:\\media-library");

test("resolveMediaPath maps a media id to a library-relative file path", () => {
  assert.strictEqual(
    resolveMediaPath(libraryPath, "salsa/first.mp4"),
    resolve(libraryPath, "salsa", "first.mp4"),
  );
});

test("resolveMediaPath accepts backslash separators in the media id", () => {
  assert.strictEqual(
    resolveMediaPath(libraryPath, "salsa\\first.mp4"),
    resolve(libraryPath, "salsa", "first.mp4"),
  );
});

test("resolveMediaPath rejects path traversal using parent segments", () => {
  assert.strictEqual(resolveMediaPath(libraryPath, "../secret.mp4"), undefined);
  assert.strictEqual(resolveMediaPath(libraryPath, "salsa/../../secret.mp4"), undefined);
});

test("resolveMediaPath rejects absolute media ids", () => {
  assert.strictEqual(resolveMediaPath(libraryPath, "/salsa/first.mp4"), undefined);
  assert.strictEqual(resolveMediaPath(libraryPath, "C:/outside/first.mp4"), undefined);
});

test("resolveMediaPath rejects empty media ids", () => {
  assert.strictEqual(resolveMediaPath(libraryPath, ""), undefined);
});

test("resolveMediaPath never resolves outside the configured library root", () => {
  const resolvedPath = resolveMediaPath(libraryPath, "salsa/..\\..\\outside.mp4");

  assert.strictEqual(resolvedPath, undefined);
  assert.notStrictEqual(resolvedPath, resolve("C:\\outside.mp4"));
  assert.notStrictEqual(resolvedPath, resolve(libraryPath, "..", "outside.mp4"));
});

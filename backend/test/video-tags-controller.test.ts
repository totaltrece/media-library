import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseVideoTagsCollectionPath,
  parseVideoTagsItemPath,
} from "../src/adapters/http/video-tags-controller.js";

test("parseVideoTagsCollectionPath extracts a media id that contains slashes", () => {
  assert.deepEqual(parseVideoTagsCollectionPath("salsa/first.mp4/tags"), {
    mediaId: "salsa/first.mp4",
  });
});

test("parseVideoTagsCollectionPath rejects paths that are not a tags collection", () => {
  assert.equal(parseVideoTagsCollectionPath("salsa/first.mp4"), undefined);
  assert.equal(parseVideoTagsCollectionPath("salsa/first.mp4/tags/"), undefined);
  assert.equal(parseVideoTagsCollectionPath("/tags"), undefined);
});

test("parseVideoTagsItemPath decodes tag names with reserved characters", () => {
  assert.deepEqual(parseVideoTagsItemPath("salsa/first.mp4/tags/mano-cadera"), {
    mediaId: "salsa/first.mp4",
    tagName: "mano-cadera",
  });
  assert.deepEqual(parseVideoTagsItemPath("salsa/first.mp4/tags/foo%2Fbar"), {
    mediaId: "salsa/first.mp4",
    tagName: "foo/bar",
  });
  assert.deepEqual(parseVideoTagsItemPath("salsa/first.mp4/tags/a%20b"), {
    mediaId: "salsa/first.mp4",
    tagName: "a b",
  });
});

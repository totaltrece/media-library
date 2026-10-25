import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  findSqliteCatalogIntegrityIssues,
  readSqliteCatalogDump,
  type SqliteCatalogDump,
} from "../src/adapters/sqlite/sqlite-catalog-dump.js";

const sampleDump: SqliteCatalogDump = {
  tagTypes: [{ id: 1, name: "type", color: "#c0392b", is_default: 0, sort_order: 1 }],
  tags: [{ id: 1, name: "salsa", tag_type_id: 1 }],
  videos: [{ id: "clip.mp4", recorded_at: null }],
  videoTags: [{ video_id: "clip.mp4", tag_id: 1, position: 0 }],
  users: [],
};

test("findSqliteCatalogIntegrityIssues accepts a consistent catalog", () => {
  assert.deepEqual(findSqliteCatalogIntegrityIssues(sampleDump), []);
});

test("findSqliteCatalogIntegrityIssues reports missing relations", () => {
  assert.match(
    findSqliteCatalogIntegrityIssues({
      ...sampleDump,
      tags: [{ id: 1, name: "salsa", tag_type_id: 99 }],
      videoTags: [{ video_id: "missing.mp4", tag_id: 2, position: 0 }],
    }).join("\n"),
    /missing tag type 99[\s\S]*missing video missing\.mp4[\s\S]*missing tag 2/,
  );
});

test("readSqliteCatalogDump opens the workspace SQLite file without writing", () => {
  const dump = readSqliteCatalogDump(
    join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "data", "library.sqlite"),
  );

  assert.ok(dump.videos.length > 0);
  assert.ok(dump.tags.length > 0);
  assert.ok(dump.tagTypes.length > 0);
  assert.deepEqual(findSqliteCatalogIntegrityIssues(dump), []);
});

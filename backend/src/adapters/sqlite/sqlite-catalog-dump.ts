import { existsSync, renameSync, unlinkSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { openSqliteDatabase } from "./sqlite-library-store.js";

export interface SqliteCatalogDump {
  tagTypes: Record<string, unknown>[];
  tags: Record<string, unknown>[];
  videos: Record<string, unknown>[];
  videoTags: Record<string, unknown>[];
  users: Record<string, unknown>[];
}

export function readSqliteCatalogDump(sqlitePath: string): SqliteCatalogDump {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });

  try {
    return {
      tagTypes: asRecords(
        database.prepare("SELECT id, name, color, is_default, sort_order FROM tag_types ORDER BY id").all(),
      ),
      tags: asRecords(database.prepare("SELECT id, name, tag_type_id FROM tags ORDER BY id").all()),
      videos: asRecords(database.prepare("SELECT id, recorded_at FROM videos ORDER BY id").all()),
      videoTags: asRecords(
        database.prepare("SELECT video_id, tag_id, position FROM video_tags ORDER BY video_id, position").all(),
      ),
      users: asRecords(
        database.prepare("SELECT id, username, password_hash, role, created_at FROM users ORDER BY id").all(),
      ),
    };
  } finally {
    database.close();
  }
}

export function findSqliteCatalogIntegrityIssues(dump: SqliteCatalogDump): string[] {
  const issues: string[] = [];
  const typeIds = new Set(dump.tagTypes.map((row) => Number(row.id)));
  const tagIds = new Set(dump.tags.map((row) => Number(row.id)));
  const videoIds = new Set(dump.videos.map((row) => String(row.id)));
  const positions = new Map<string, Set<number>>();

  for (const tag of dump.tags) {
    if (!typeIds.has(Number(tag.tag_type_id))) {
      issues.push(`Tag ${String(tag.id)} references missing tag type ${String(tag.tag_type_id)}`);
    }
  }

  for (const relation of dump.videoTags) {
    const videoId = String(relation.video_id);
    const tagId = Number(relation.tag_id);
    const position = Number(relation.position);

    if (!videoIds.has(videoId)) {
      issues.push(`video_tags references missing video ${videoId}`);
    }

    if (!tagIds.has(tagId)) {
      issues.push(`video_tags references missing tag ${tagId}`);
    }

    const used = positions.get(videoId) ?? new Set<number>();

    if (used.has(position)) {
      issues.push(`Duplicate position ${position} for video ${videoId}`);
    }

    used.add(position);
    positions.set(videoId, used);
  }

  return issues;
}

export function writeSqliteCatalogDump(sqlitePath: string, dump: SqliteCatalogDump): void {
  const issues = findSqliteCatalogIntegrityIssues(dump);

  if (issues.length > 0) {
    throw new Error(`Catalog dump is inconsistent: ${issues.join("; ")}`);
  }

  const tmpPath = `${sqlitePath}.tmp`;

  if (existsSync(tmpPath)) {
    unlinkSync(tmpPath);
  }

  const database = openSqliteDatabase(tmpPath);

  try {
    database.exec("PRAGMA foreign_keys = OFF");
    database.exec("BEGIN");
    database.exec("DELETE FROM video_tags");
    database.exec("DELETE FROM tags");
    database.exec("DELETE FROM videos");
    database.exec("DELETE FROM sessions");
    database.exec("DELETE FROM users");
    database.exec("DELETE FROM tag_types");

    const insertTagType = database.prepare(
      "INSERT INTO tag_types (id, name, color, is_default, sort_order) VALUES (?, ?, ?, ?, ?)",
    );
    const insertTag = database.prepare("INSERT INTO tags (id, name, tag_type_id) VALUES (?, ?, ?)");
    const insertVideo = database.prepare("INSERT INTO videos (id, recorded_at) VALUES (?, ?)");
    const insertVideoTag = database.prepare(
      "INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)",
    );
    const insertUser = database.prepare(
      "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
    );

    for (const row of dump.tagTypes) {
      insertTagType.run(
        sqlInteger(row.id),
        sqlText(row.name),
        sqlText(row.color),
        sqlInteger(row.is_default),
        sqlInteger(row.sort_order),
      );
    }

    for (const row of dump.tags) {
      insertTag.run(sqlInteger(row.id), sqlText(row.name), sqlInteger(row.tag_type_id));
    }

    for (const row of dump.videos) {
      insertVideo.run(sqlText(row.id), sqlNullableText(row.recorded_at));
    }

    for (const row of dump.videoTags) {
      insertVideoTag.run(sqlText(row.video_id), sqlInteger(row.tag_id), sqlInteger(row.position));
    }

    for (const row of dump.users) {
      insertUser.run(
        sqlInteger(row.id),
        sqlText(row.username),
        sqlText(row.password_hash),
        sqlText(row.role),
        sqlText(row.created_at),
      );
    }

    database.exec("COMMIT");
    database.exec("PRAGMA foreign_keys = ON");
  } catch (error: unknown) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // The write is discarded with the temp file below.
    }

    database.close();

    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath);
    }

    throw error;
  }

  database.close();

  if (existsSync(sqlitePath)) {
    unlinkSync(sqlitePath);
  }

  renameSync(tmpPath, sqlitePath);
}

function sqlInteger(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("Expected an integer catalog value");
  }

  return parsed;
}

function sqlText(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Expected a text catalog value");
  }

  return value;
}

function sqlNullableText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return sqlText(value);
}

function asRecords(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
}

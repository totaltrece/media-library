import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  LibraryStore,
  LibraryTag,
  LibraryTagType,
  LibraryTagUsage,
  LibraryVideo,
  LibraryVideoWithTags,
} from "../../ports/library-store.js";

import { sqliteMigrations } from "./migrations.js";
import { SqliteAuthStore } from "./sqlite-auth-store.js";

const TAG_SELECT = `
  SELECT
    tags.id AS id,
    tags.name AS name,
    tag_types.id AS typeId,
    tag_types.name AS typeName,
    tag_types.color AS color,
    tag_types.sort_order AS typeSortOrder
  FROM tags
  INNER JOIN tag_types ON tag_types.id = tags.tag_type_id
`;

const TAG_TYPE_SELECT = `
  SELECT
    tag_types.id AS id,
    tag_types.name AS name,
    tag_types.color AS color,
    tag_types.is_default AS isDefault,
    tag_types.sort_order AS sortOrder,
    COUNT(tags.id) AS tagCount
  FROM tag_types
  LEFT JOIN tags ON tags.tag_type_id = tag_types.id
`;

export class SqliteLibraryStore implements LibraryStore {
  constructor(private readonly database: DatabaseSync) {}

  initialize(): void {
    applySqliteMigrations(this.database);
  }

  close(): void {
    this.database.close();
  }

  upsertVideo(id: string, recordedAt: string | null = null): LibraryVideo {
    const videoId = requireNonEmpty(id, "Video id");

    this.database
      .prepare(
        `
          INSERT INTO videos (id, recorded_at) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET recorded_at = COALESCE(videos.recorded_at, excluded.recorded_at)
        `,
      )
      .run(videoId, recordedAt);

    const video = this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  findVideo(id: string): LibraryVideo | null {
    const row = this.database.prepare("SELECT id, recorded_at FROM videos WHERE id = ?").get(id);

    return isVideoRow(row) ? toLibraryVideo(row) : null;
  }

  listVideos(): LibraryVideo[] {
    const rows = this.database.prepare("SELECT id, recorded_at FROM videos ORDER BY id").all();

    return rows.filter(isVideoRow).map((row) => toLibraryVideo(row));
  }

  setVideoRecordedAt(id: string, recordedAt: string | null): LibraryVideo {
    const videoId = requireNonEmpty(id, "Video id");
    const result = this.database.prepare("UPDATE videos SET recorded_at = ? WHERE id = ?").run(recordedAt, videoId);

    if (result.changes === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const video = this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  deleteVideo(id: string): void {
    const result = this.database.prepare("DELETE FROM videos WHERE id = ?").run(id);

    if (result.changes === 0) {
      throw new Error(`Video not found: ${id}`);
    }
  }

  upsertTag(name: string): LibraryTag {
    const tagName = requireNonEmpty(name, "Tag name");
    const defaultType = this.requireDefaultTagType();

    this.database
      .prepare("INSERT INTO tags (name, tag_type_id) VALUES (?, ?) ON CONFLICT(name) DO NOTHING")
      .run(tagName, defaultType.id);

    const tag = this.findTagByName(tagName);

    if (tag === null) {
      throw new Error(`Unable to persist tag ${tagName}`);
    }

    return tag;
  }

  findTagByName(name: string): LibraryTag | null {
    const row = this.database.prepare(`${TAG_SELECT} WHERE tags.name = ?`).get(name);

    return isTagRow(row) ? toLibraryTag(row) : null;
  }

  findTagById(id: number): LibraryTag | null {
    const row = this.database.prepare(`${TAG_SELECT} WHERE tags.id = ?`).get(id);

    return isTagRow(row) ? toLibraryTag(row) : null;
  }

  listTags(): LibraryTag[] {
    const rows = this.database.prepare(`${TAG_SELECT} ORDER BY tags.name`).all();

    return rows.filter(isTagRow).map((row) => toLibraryTag(row));
  }

  listTagUsages(): LibraryTagUsage[] {
    const rows = this.database
      .prepare(
        `
          SELECT
            tags.id AS id,
            tags.name AS name,
            tag_types.id AS typeId,
            tag_types.name AS typeName,
            tag_types.color AS color,
            tag_types.sort_order AS typeSortOrder,
            COUNT(video_tags.video_id) AS usageCount
          FROM tags
          INNER JOIN tag_types ON tag_types.id = tags.tag_type_id
          LEFT JOIN video_tags ON video_tags.tag_id = tags.id
          GROUP BY tags.id, tags.name, tag_types.id, tag_types.name, tag_types.color, tag_types.sort_order
          ORDER BY tags.name
        `,
      )
      .all();

    return rows.filter(isTagUsageRow).map((row) => toLibraryTagUsage(row));
  }

  updateTag(id: number, name: string, typeId: number): LibraryTag {
    const tagName = requireNonEmpty(name, "Tag name");
    const current = this.findTagById(id);

    if (current === null) {
      throw new Error(`Tag not found: ${id}`);
    }

    if (this.findTagTypeById(typeId) === null) {
      throw new Error(`Tag type not found: ${typeId}`);
    }

    if (current.name !== tagName) {
      const conflict = this.findTagByName(tagName);

      if (conflict !== null) {
        throw new Error(`Tag name already exists: ${tagName}`);
      }
    }

    this.database
      .prepare("UPDATE tags SET name = ?, tag_type_id = ? WHERE id = ?")
      .run(tagName, typeId, id);

    const updated = this.findTagById(id);

    if (updated === null) {
      throw new Error(`Unable to update tag ${id}`);
    }

    return updated;
  }

  deleteTag(id: number): void {
    const result = this.database.prepare("DELETE FROM tags WHERE id = ?").run(id);

    if (result.changes === 0) {
      throw new Error(`Tag not found: ${id}`);
    }
  }

  listTagTypes(): LibraryTagType[] {
    const rows = this.database
      .prepare(`${TAG_TYPE_SELECT} GROUP BY tag_types.id ORDER BY tag_types.sort_order, tag_types.name`)
      .all();

    return rows.filter(isTagTypeRow).map((row) => toLibraryTagType(row));
  }

  findTagTypeById(id: number): LibraryTagType | null {
    const row = this.database.prepare(`${TAG_TYPE_SELECT} WHERE tag_types.id = ? GROUP BY tag_types.id`).get(id);

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  findDefaultTagType(): LibraryTagType | null {
    const row = this.database
      .prepare(`${TAG_TYPE_SELECT} WHERE tag_types.is_default = 1 GROUP BY tag_types.id`)
      .get();

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  createTagType(name: string, color: string): LibraryTagType {
    const typeName = requireNonEmpty(name, "Tag type name");
    const conflict = this.findTagTypeByName(typeName);

    if (conflict !== null) {
      throw new Error(`Tag type name already exists: ${typeName}`);
    }

    const nextOrderRow = this.database.prepare("SELECT MAX(sort_order) AS sortOrder FROM tag_types").get();
    const sortOrder = isSortOrderRow(nextOrderRow) && nextOrderRow.sortOrder !== null
      ? Number(nextOrderRow.sortOrder) + 1
      : 1;

    const result = this.database
      .prepare("INSERT INTO tag_types (name, color, is_default, sort_order) VALUES (?, ?, 0, ?)")
      .run(typeName, color, sortOrder);

    const created = this.findTagTypeById(Number(result.lastInsertRowid));

    if (created === null) {
      throw new Error(`Unable to persist tag type ${typeName}`);
    }

    return created;
  }

  updateTagType(id: number, name: string, color: string): LibraryTagType {
    const typeName = requireNonEmpty(name, "Tag type name");
    const current = this.findTagTypeById(id);

    if (current === null) {
      throw new Error(`Tag type not found: ${id}`);
    }

    const conflict = this.findTagTypeByName(typeName);

    if (conflict !== null && conflict.id !== id) {
      throw new Error(`Tag type name already exists: ${typeName}`);
    }

    this.database.prepare("UPDATE tag_types SET name = ?, color = ? WHERE id = ?").run(typeName, color, id);

    const updated = this.findTagTypeById(id);

    if (updated === null) {
      throw new Error(`Unable to update tag type ${id}`);
    }

    return updated;
  }

  deleteTagType(id: number): void {
    const current = this.findTagTypeById(id);

    if (current === null) {
      throw new Error(`Tag type not found: ${id}`);
    }

    if (current.isDefault) {
      throw new Error("Default tag type cannot be deleted");
    }

    if (current.tagCount > 0) {
      throw new Error(`Tag type is in use: ${current.name}`);
    }

    this.database.prepare("DELETE FROM tag_types WHERE id = ?").run(id);
  }

  setVideoTags(videoId: string, tagNames: string[]): void {
    const video = this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    this.database.exec("BEGIN");

    try {
      this.database.prepare("DELETE FROM video_tags WHERE video_id = ?").run(videoId);

      tagNames.forEach((tagName, position) => {
        const tag = this.upsertTag(tagName);

        this.database
          .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
          .run(videoId, tag.id, position);
      });

      this.database.exec("COMMIT");
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  addVideoTag(videoId: string, tagName: string): void {
    const video = this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const currentTags = this.getVideoTags(videoId);

    if (currentTags.includes(tagName)) {
      return;
    }

    this.database.exec("BEGIN");

    try {
      const tag = this.upsertTag(tagName);
      const nextPosition = nextVideoTagPosition(this.database, videoId);

      this.database
        .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
        .run(videoId, tag.id, nextPosition);

      this.database.exec("COMMIT");
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  removeVideoTag(videoId: string, tagName: string): void {
    const video = this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const tag = this.findTagByName(tagName);

    if (tag === null) {
      return;
    }

    this.database.prepare("DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?").run(videoId, tag.id);
  }

  getVideoTags(videoId: string): string[] {
    const rows = this.database
      .prepare(
        `
          SELECT tags.name AS name
          FROM video_tags
          INNER JOIN tags ON tags.id = video_tags.tag_id
          WHERE video_tags.video_id = ?
          ORDER BY video_tags.position
        `,
      )
      .all(videoId);

    return rows.filter(isNameRow).map((row) => row.name);
  }

  listVideosWithTags(): LibraryVideoWithTags[] {
    return this.listVideos().map((video) => ({
      id: video.id,
      recordedAt: video.recordedAt,
      tags: this.getVideoTags(video.id),
    }));
  }

  private findTagTypeByName(name: string): LibraryTagType | null {
    const row = this.database.prepare(`${TAG_TYPE_SELECT} WHERE tag_types.name = ? GROUP BY tag_types.id`).get(name);

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  private requireDefaultTagType(): LibraryTagType {
    const defaultType = this.findDefaultTagType();

    if (defaultType === null) {
      throw new Error("Default tag type is missing");
    }

    return defaultType;
  }
}

export interface SqliteStores {
  libraryStore: SqliteLibraryStore;
  authStore: SqliteAuthStore;
  close(): void;
}

export function openSqliteDatabase(databasePath: string): DatabaseSync {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  applySqliteMigrations(database);
  return database;
}

export function openSqliteStores(databasePath: string): SqliteStores {
  const database = openSqliteDatabase(databasePath);

  return {
    libraryStore: new SqliteLibraryStore(database),
    authStore: new SqliteAuthStore(database),
    close: () => {
      database.close();
    },
  };
}

export function openSqliteLibraryStore(databasePath: string): SqliteLibraryStore {
  return new SqliteLibraryStore(openSqliteDatabase(databasePath));
}

export function applySqliteMigrations(database: DatabaseSync): void {
  database.exec("PRAGMA foreign_keys = OFF");
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const appliedVersions = new Set(
    database
      .prepare("SELECT version FROM schema_migrations")
      .all()
      .filter(isVersionRow)
      .map((row) => Number(row.version)),
  );

  for (const migration of sqliteMigrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    database.exec("BEGIN");

    try {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(migration.version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error: unknown) {
      database.exec("ROLLBACK");
      throw error;
    }
  }

  database.exec("PRAGMA foreign_keys = ON");
}

function requireNonEmpty(value: string, label: string): string {
  if (value.length === 0) {
    throw new Error(`${label} must not be empty`);
  }

  return value;
}

function nextVideoTagPosition(database: DatabaseSync, videoId: string): number {
  const row = database
    .prepare("SELECT MAX(position) AS position FROM video_tags WHERE video_id = ?")
    .get(videoId);

  if (!isPositionRow(row) || row.position === null) {
    return 0;
  }

  return Number(row.position) + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVideoRow(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function toLibraryVideo(row: unknown): LibraryVideo {
  if (!isVideoRow(row)) {
    throw new Error("Invalid video row");
  }

  return {
    id: row.id,
    recordedAt: typeof row.recorded_at === "string" && row.recorded_at.length > 0 ? row.recorded_at : null,
  };
}

function toLibraryTag(row: unknown): LibraryTag {
  if (!isTagRow(row)) {
    throw new Error("Invalid tag row");
  }

  return {
    id: Number(row.id),
    name: row.name,
    typeId: Number(row.typeId),
    typeName: row.typeName,
    color: row.color,
    typeSortOrder: Number(row.typeSortOrder),
  };
}

function toLibraryTagUsage(row: unknown): LibraryTagUsage {
  if (!isTagUsageRow(row)) {
    throw new Error("Invalid tag usage row");
  }

  return {
    ...toLibraryTag(row),
    usageCount: Number(row.usageCount),
  };
}

function toLibraryTagType(row: unknown): LibraryTagType {
  if (!isTagTypeRow(row)) {
    throw new Error("Invalid tag type row");
  }

  return {
    id: Number(row.id),
    name: row.name,
    color: row.color,
    isDefault: Number(row.isDefault) === 1,
    sortOrder: Number(row.sortOrder),
    tagCount: Number(row.tagCount),
  };
}

interface TagRow {
  id: number | bigint;
  name: string;
  typeId: number | bigint;
  typeName: string;
  color: string;
  typeSortOrder: number | bigint;
}

interface TagUsageRow extends TagRow {
  usageCount: number | bigint;
}

interface TagTypeRow {
  id: number | bigint;
  name: string;
  color: string;
  isDefault: number | bigint;
  sortOrder: number | bigint;
  tagCount: number | bigint;
}

function isTagRow(value: unknown): value is TagRow {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "bigint") &&
    typeof value.name === "string" &&
    (typeof value.typeId === "number" || typeof value.typeId === "bigint") &&
    typeof value.typeName === "string" &&
    typeof value.color === "string" &&
    (typeof value.typeSortOrder === "number" || typeof value.typeSortOrder === "bigint")
  );
}

function isNameRow(value: unknown): value is { name: string } {
  return isRecord(value) && typeof value.name === "string";
}

function isTagUsageRow(value: unknown): value is TagUsageRow {
  return (
    isTagRow(value) &&
    isRecord(value) &&
    (typeof value["usageCount"] === "number" || typeof value["usageCount"] === "bigint")
  );
}

function isTagTypeRow(value: unknown): value is TagTypeRow {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "bigint") &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    (typeof value.isDefault === "number" || typeof value.isDefault === "bigint") &&
    (typeof value.sortOrder === "number" || typeof value.sortOrder === "bigint") &&
    (typeof value.tagCount === "number" || typeof value.tagCount === "bigint")
  );
}

function isSortOrderRow(value: unknown): value is { sortOrder: number | bigint | null } {
  return (
    isRecord(value) &&
    (value.sortOrder === null || typeof value.sortOrder === "number" || typeof value.sortOrder === "bigint")
  );
}

function isPositionRow(value: unknown): value is { position: number | bigint | null } {
  return (
    isRecord(value) &&
    (value.position === null || typeof value.position === "number" || typeof value.position === "bigint")
  );
}

function isVersionRow(value: unknown): value is { version: number | bigint } {
  return isRecord(value) && (typeof value.version === "number" || typeof value.version === "bigint");
}

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

  async initialize(): Promise<void> {
    applySqliteMigrations(this.database);
  }

  async close(): Promise<void> {
    this.database.close();
  }

  async upsertVideo(id: string, recordedAt: string | null = null): Promise<LibraryVideo> {
    const videoId = requireNonEmpty(id, "Video id");

    this.database
      .prepare(
        `
          INSERT INTO videos (id, recorded_at) VALUES (?, ?)
          ON CONFLICT(id) DO UPDATE SET recorded_at = COALESCE(videos.recorded_at, excluded.recorded_at)
        `,
      )
      .run(videoId, recordedAt);

    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  async findVideo(id: string): Promise<LibraryVideo | null> {
    const row = this.database.prepare("SELECT id, recorded_at FROM videos WHERE id = ?").get(id);

    return isVideoRow(row) ? toLibraryVideo(row) : null;
  }

  async listVideos(): Promise<LibraryVideo[]> {
    const rows = this.database.prepare("SELECT id, recorded_at FROM videos ORDER BY id").all();

    return rows.filter(isVideoRow).map((row) => toLibraryVideo(row));
  }

  async setVideoRecordedAt(id: string, recordedAt: string | null): Promise<LibraryVideo> {
    const videoId = requireNonEmpty(id, "Video id");
    const result = this.database.prepare("UPDATE videos SET recorded_at = ? WHERE id = ?").run(recordedAt, videoId);

    if (result.changes === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  async deleteVideo(id: string): Promise<void> {
    const result = this.database.prepare("DELETE FROM videos WHERE id = ?").run(id);

    if (result.changes === 0) {
      throw new Error(`Video not found: ${id}`);
    }
  }

  async upsertTag(name: string): Promise<LibraryTag> {
    const tagName = requireNonEmpty(name, "Tag name");
    const defaultType = await this.requireDefaultTagType();

    this.database
      .prepare("INSERT INTO tags (name, tag_type_id) VALUES (?, ?) ON CONFLICT(name) DO NOTHING")
      .run(tagName, defaultType.id);

    const tag = await this.findTagByName(tagName);

    if (tag === null) {
      throw new Error(`Unable to persist tag ${tagName}`);
    }

    return tag;
  }

  async findTagByName(name: string): Promise<LibraryTag | null> {
    const row = this.database.prepare(`${TAG_SELECT} WHERE tags.name = ?`).get(name);

    return isTagRow(row) ? toLibraryTag(row) : null;
  }

  async findTagById(id: number): Promise<LibraryTag | null> {
    const row = this.database.prepare(`${TAG_SELECT} WHERE tags.id = ?`).get(id);

    return isTagRow(row) ? toLibraryTag(row) : null;
  }

  async listTags(): Promise<LibraryTag[]> {
    const rows = this.database.prepare(`${TAG_SELECT} ORDER BY tags.name`).all();

    return rows.filter(isTagRow).map((row) => toLibraryTag(row));
  }

  async listTagUsages(): Promise<LibraryTagUsage[]> {
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

  async updateTag(id: number, name: string, typeId: number): Promise<LibraryTag> {
    const tagName = requireNonEmpty(name, "Tag name");
    const current = await this.findTagById(id);

    if (current === null) {
      throw new Error(`Tag not found: ${id}`);
    }

    if (await this.findTagTypeById(typeId) === null) {
      throw new Error(`Tag type not found: ${typeId}`);
    }

    if (current.name !== tagName) {
      const conflict = await this.findTagByName(tagName);

      if (conflict !== null) {
        throw new Error(`Tag name already exists: ${tagName}`);
      }
    }

    this.database
      .prepare("UPDATE tags SET name = ?, tag_type_id = ? WHERE id = ?")
      .run(tagName, typeId, id);

    const updated = await this.findTagById(id);

    if (updated === null) {
      throw new Error(`Unable to update tag ${id}`);
    }

    return updated;
  }

  async deleteTag(id: number): Promise<void> {
    const result = this.database.prepare("DELETE FROM tags WHERE id = ?").run(id);

    if (result.changes === 0) {
      throw new Error(`Tag not found: ${id}`);
    }
  }

  async listTagTypes(): Promise<LibraryTagType[]> {
    const rows = this.database
      .prepare(`${TAG_TYPE_SELECT} GROUP BY tag_types.id ORDER BY tag_types.sort_order, tag_types.name`)
      .all();

    return rows.filter(isTagTypeRow).map((row) => toLibraryTagType(row));
  }

  async findTagTypeById(id: number): Promise<LibraryTagType | null> {
    const row = this.database.prepare(`${TAG_TYPE_SELECT} WHERE tag_types.id = ? GROUP BY tag_types.id`).get(id);

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  async findDefaultTagType(): Promise<LibraryTagType | null> {
    const row = this.database
      .prepare(`${TAG_TYPE_SELECT} WHERE tag_types.is_default = 1 GROUP BY tag_types.id`)
      .get();

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  async createTagType(name: string, color: string): Promise<LibraryTagType> {
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

    const created = await this.findTagTypeById(Number(result.lastInsertRowid));

    if (created === null) {
      throw new Error(`Unable to persist tag type ${typeName}`);
    }

    return created;
  }

  async updateTagType(id: number, name: string, color: string): Promise<LibraryTagType> {
    const typeName = requireNonEmpty(name, "Tag type name");
    const current = await this.findTagTypeById(id);

    if (current === null) {
      throw new Error(`Tag type not found: ${id}`);
    }

    const conflict = this.findTagTypeByName(typeName);

    if (conflict !== null && conflict.id !== id) {
      throw new Error(`Tag type name already exists: ${typeName}`);
    }

    this.database.prepare("UPDATE tag_types SET name = ?, color = ? WHERE id = ?").run(typeName, color, id);

    const updated = await this.findTagTypeById(id);

    if (updated === null) {
      throw new Error(`Unable to update tag type ${id}`);
    }

    return updated;
  }

  async deleteTagType(id: number): Promise<void> {
    const current = await this.findTagTypeById(id);

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

  async setVideoTags(videoId: string, tagNames: string[]): Promise<void> {
    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    this.database.exec("BEGIN");

    try {
      this.database.prepare("DELETE FROM video_tags WHERE video_id = ?").run(videoId);

      for (const [position, tagName] of tagNames.entries()) {
        const tag = await this.upsertTag(tagName);

        this.database
          .prepare("INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)")
          .run(videoId, tag.id, position);
      }

      this.database.exec("COMMIT");
    } catch (error: unknown) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  async addVideoTag(videoId: string, tagName: string): Promise<void> {
    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const currentTags = await this.getVideoTags(videoId);

    if (currentTags.includes(tagName)) {
      return;
    }

    this.database.exec("BEGIN");

    try {
      const tag = await this.upsertTag(tagName);
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

  async removeVideoTag(videoId: string, tagName: string): Promise<void> {
    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const tag = await this.findTagByName(tagName);

    if (tag === null) {
      return;
    }

    this.database.prepare("DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?").run(videoId, tag.id);
  }

  async getVideoTags(videoId: string): Promise<string[]> {
    const rows = this.database
      .prepare(
        `
          SELECT tags.name AS name
          FROM video_tags
          INNER JOIN tags ON tags.id = video_tags.tag_id
          INNER JOIN tag_types ON tag_types.id = tags.tag_type_id
          WHERE video_tags.video_id = ?
          ORDER BY tag_types.sort_order ASC, tags.name COLLATE NOCASE ASC
        `,
      )
      .all(videoId);

    return rows.filter(isNameRow).map((row) => row.name);
  }

  async listVideosWithTags(): Promise<LibraryVideoWithTags[]> {
    const videos = await this.listVideos();
    const result: LibraryVideoWithTags[] = [];

    for (const video of videos) {
      result.push({
        id: video.id,
        recordedAt: video.recordedAt,
        tags: await this.getVideoTags(video.id),
      });
    }

    return result;
  }

  private findTagTypeByName(name: string): LibraryTagType | null {
    const row = this.database.prepare(`${TAG_TYPE_SELECT} WHERE tag_types.name = ? GROUP BY tag_types.id`).get(name);

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  private async requireDefaultTagType(): Promise<LibraryTagType> {
    const defaultType = await this.findDefaultTagType();

    if (defaultType === null) {
      throw new Error("Default tag type is missing");
    }

    return defaultType;
  }
}

export interface SqliteStores {
  libraryStore: SqliteLibraryStore;
  authStore: SqliteAuthStore;
  close(): Promise<void>;
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
    close: async () => {
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

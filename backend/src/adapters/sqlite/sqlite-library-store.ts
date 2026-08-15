import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  LibraryStore,
  LibraryTag,
  LibraryTagUsage,
  LibraryVideo,
  LibraryVideoWithTags,
} from "../../ports/library-store.js";

import { sqliteMigrations } from "./migrations.js";

export class SqliteLibraryStore implements LibraryStore {
  constructor(private readonly database: DatabaseSync) {}

  initialize(): void {
    applySqliteMigrations(this.database);
  }

  close(): void {
    this.database.close();
  }

  upsertVideo(id: string): LibraryVideo {
    const videoId = requireNonEmpty(id, "Video id");

    this.database.prepare("INSERT INTO videos (id) VALUES (?) ON CONFLICT(id) DO NOTHING").run(videoId);

    const video = this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  findVideo(id: string): LibraryVideo | null {
    const row = this.database.prepare("SELECT id FROM videos WHERE id = ?").get(id);

    return isVideoRow(row) ? { id: row.id } : null;
  }

  listVideos(): LibraryVideo[] {
    const rows = this.database.prepare("SELECT id FROM videos ORDER BY id").all();

    return rows.filter(isVideoRow).map((row) => ({ id: row.id }));
  }

  deleteVideo(id: string): void {
    const result = this.database.prepare("DELETE FROM videos WHERE id = ?").run(id);

    if (result.changes === 0) {
      throw new Error(`Video not found: ${id}`);
    }
  }

  upsertTag(name: string): LibraryTag {
    const tagName = requireNonEmpty(name, "Tag name");

    this.database
      .prepare("INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING")
      .run(tagName);

    const tag = this.findTagByName(tagName);

    if (tag === null) {
      throw new Error(`Unable to persist tag ${tagName}`);
    }

    return tag;
  }

  findTagByName(name: string): LibraryTag | null {
    const row = this.database.prepare("SELECT id, name FROM tags WHERE name = ?").get(name);

    return isTagRow(row) ? { id: Number(row.id), name: row.name } : null;
  }

  findTagById(id: number): LibraryTag | null {
    const row = this.database.prepare("SELECT id, name FROM tags WHERE id = ?").get(id);

    return isTagRow(row) ? { id: Number(row.id), name: row.name } : null;
  }

  listTags(): LibraryTag[] {
    const rows = this.database.prepare("SELECT id, name FROM tags ORDER BY name").all();

    return rows.filter(isTagRow).map((row) => ({
      id: Number(row.id),
      name: row.name,
    }));
  }

  listTagUsages(): LibraryTagUsage[] {
    const rows = this.database
      .prepare(
        `
          SELECT tags.id AS id, tags.name AS name, COUNT(video_tags.video_id) AS usageCount
          FROM tags
          LEFT JOIN video_tags ON video_tags.tag_id = tags.id
          GROUP BY tags.id, tags.name
          ORDER BY tags.name
        `,
      )
      .all();

    return rows.filter(isTagUsageRow).map((row) => ({
      id: Number(row.id),
      name: row.name,
      usageCount: Number(row.usageCount),
    }));
  }

  renameTag(id: number, name: string): LibraryTag {
    const tagName = requireNonEmpty(name, "Tag name");
    const current = this.findTagById(id);

    if (current === null) {
      throw new Error(`Tag not found: ${id}`);
    }

    if (current.name === tagName) {
      return current;
    }

    const conflict = this.findTagByName(tagName);

    if (conflict !== null) {
      throw new Error(`Tag name already exists: ${tagName}`);
    }

    this.database.prepare("UPDATE tags SET name = ? WHERE id = ?").run(tagName, id);

    const renamed = this.findTagById(id);

    if (renamed === null) {
      throw new Error(`Unable to rename tag ${id}`);
    }

    return renamed;
  }

  deleteTag(id: number): void {
    const result = this.database.prepare("DELETE FROM tags WHERE id = ?").run(id);

    if (result.changes === 0) {
      throw new Error(`Tag not found: ${id}`);
    }
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
      tags: this.getVideoTags(video.id),
    }));
  }
}

export function openSqliteLibraryStore(databasePath: string): SqliteLibraryStore {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new DatabaseSync(databasePath);
  const store = new SqliteLibraryStore(database);

  store.initialize();

  return store;
}

export function applySqliteMigrations(database: DatabaseSync): void {
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

function isVideoRow(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function isTagRow(value: unknown): value is { id: number | bigint; name: string } {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "bigint") &&
    typeof value.name === "string"
  );
}

function isNameRow(value: unknown): value is { name: string } {
  return isRecord(value) && typeof value.name === "string";
}

function isTagUsageRow(
  value: unknown,
): value is { id: number | bigint; name: string; usageCount: number | bigint } {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "bigint") &&
    typeof value.name === "string" &&
    (typeof value.usageCount === "number" || typeof value.usageCount === "bigint")
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

import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";

import type {
  LibraryStore,
  LibraryTag,
  LibraryTagType,
  LibraryTagUsage,
  LibraryVideo,
  LibraryVideoWithTags,
} from "../../ports/library-store.js";
import { applyMariadbMigrations } from "./mariadb-pool.js";
import { executeChange, queryOne, queryRows, type SqlExecutor } from "./mariadb-sql.js";

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

export class MariaDbLibraryStore implements LibraryStore {
  constructor(private readonly pool: Pool) {}

  async initialize(): Promise<void> {
    await applyMariadbMigrations(this.pool);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async upsertVideo(id: string, recordedAt: string | null = null): Promise<LibraryVideo> {
    const videoId = requireNonEmpty(id, "Video id");

    await executeChange(
      this.pool,
      `
        INSERT INTO videos (id, recorded_at) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE recorded_at = COALESCE(videos.recorded_at, VALUES(recorded_at))
      `,
      [videoId, recordedAt],
    );

    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  async findVideo(id: string): Promise<LibraryVideo | null> {
    const row = await queryOne(this.pool, "SELECT id, recorded_at FROM videos WHERE id = ?", [id]);

    return isVideoRow(row) ? toLibraryVideo(row) : null;
  }

  async listVideos(): Promise<LibraryVideo[]> {
    const rows = await queryRows(this.pool, "SELECT id, recorded_at FROM videos ORDER BY id");

    return rows.filter(isVideoRow).map((row) => toLibraryVideo(row));
  }

  async setVideoRecordedAt(id: string, recordedAt: string | null): Promise<LibraryVideo> {
    const videoId = requireNonEmpty(id, "Video id");
    const result = await executeChange(this.pool, "UPDATE videos SET recorded_at = ? WHERE id = ?", [
      recordedAt,
      videoId,
    ]);

    if (result.affectedRows === 0) {
      throw new Error(`Video not found: ${videoId}`);
    }

    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Unable to persist video ${videoId}`);
    }

    return video;
  }

  async deleteVideo(id: string): Promise<void> {
    const result = await executeChange(this.pool, "DELETE FROM videos WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      throw new Error(`Video not found: ${id}`);
    }
  }

  async upsertTag(name: string): Promise<LibraryTag> {
    const tagName = requireNonEmpty(name, "Tag name");
    const defaultType = await this.requireDefaultTagType();

    await executeChange(this.pool, "INSERT IGNORE INTO tags (name, tag_type_id) VALUES (?, ?)", [
      tagName,
      defaultType.id,
    ]);

    const tag = await this.findTagByName(tagName);

    if (tag === null) {
      throw new Error(`Unable to persist tag ${tagName}`);
    }

    return tag;
  }

  async findTagByName(name: string): Promise<LibraryTag | null> {
    const row = await queryOne(this.pool, `${TAG_SELECT} WHERE tags.name = ?`, [name]);

    return isTagRow(row) ? toLibraryTag(row) : null;
  }

  async findTagById(id: number): Promise<LibraryTag | null> {
    const row = await queryOne(this.pool, `${TAG_SELECT} WHERE tags.id = ?`, [id]);

    return isTagRow(row) ? toLibraryTag(row) : null;
  }

  async listTags(): Promise<LibraryTag[]> {
    const rows = await queryRows(this.pool, `${TAG_SELECT} ORDER BY tags.name`);

    return rows.filter(isTagRow).map((row) => toLibraryTag(row));
  }

  async listTagUsages(): Promise<LibraryTagUsage[]> {
    const rows = await queryRows(
      this.pool,
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
    );

    return rows.filter(isTagUsageRow).map((row) => toLibraryTagUsage(row));
  }

  async updateTag(id: number, name: string, typeId: number): Promise<LibraryTag> {
    const tagName = requireNonEmpty(name, "Tag name");
    const current = await this.findTagById(id);

    if (current === null) {
      throw new Error(`Tag not found: ${id}`);
    }

    if ((await this.findTagTypeById(typeId)) === null) {
      throw new Error(`Tag type not found: ${typeId}`);
    }

    if (current.name !== tagName) {
      const conflict = await this.findTagByName(tagName);

      if (conflict !== null) {
        throw new Error(`Tag name already exists: ${tagName}`);
      }
    }

    await executeChange(this.pool, "UPDATE tags SET name = ?, tag_type_id = ? WHERE id = ?", [tagName, typeId, id]);

    const updated = await this.findTagById(id);

    if (updated === null) {
      throw new Error(`Unable to update tag ${id}`);
    }

    return updated;
  }

  async deleteTag(id: number): Promise<void> {
    const result = await executeChange(this.pool, "DELETE FROM tags WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      throw new Error(`Tag not found: ${id}`);
    }
  }

  async listTagTypes(): Promise<LibraryTagType[]> {
    const rows = await queryRows(
      this.pool,
      `${TAG_TYPE_SELECT} GROUP BY tag_types.id, tag_types.name, tag_types.color, tag_types.is_default, tag_types.sort_order ORDER BY tag_types.sort_order, tag_types.name`,
    );

    return rows.filter(isTagTypeRow).map((row) => toLibraryTagType(row));
  }

  async findTagTypeById(id: number): Promise<LibraryTagType | null> {
    const row = await queryOne(
      this.pool,
      `${TAG_TYPE_SELECT} WHERE tag_types.id = ? GROUP BY tag_types.id, tag_types.name, tag_types.color, tag_types.is_default, tag_types.sort_order`,
      [id],
    );

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  async findDefaultTagType(): Promise<LibraryTagType | null> {
    const row = await queryOne(
      this.pool,
      `${TAG_TYPE_SELECT} WHERE tag_types.is_default = 1 GROUP BY tag_types.id, tag_types.name, tag_types.color, tag_types.is_default, tag_types.sort_order`,
    );

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  async createTagType(name: string, color: string): Promise<LibraryTagType> {
    const typeName = requireNonEmpty(name, "Tag type name");
    const conflict = await this.findTagTypeByName(typeName);

    if (conflict !== null) {
      throw new Error(`Tag type name already exists: ${typeName}`);
    }

    const nextOrderRow = await queryOne(this.pool, "SELECT MAX(sort_order) AS sortOrder FROM tag_types");
    const sortOrder =
      isSortOrderRow(nextOrderRow) && nextOrderRow.sortOrder !== null ? Number(nextOrderRow.sortOrder) + 1 : 1;

    const result = await executeChange(
      this.pool,
      "INSERT INTO tag_types (name, color, is_default, sort_order) VALUES (?, ?, 0, ?)",
      [typeName, color, sortOrder],
    );
    const created = await this.findTagTypeById(Number(result.insertId));

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

    const conflict = await this.findTagTypeByName(typeName);

    if (conflict !== null && conflict.id !== id) {
      throw new Error(`Tag type name already exists: ${typeName}`);
    }

    await executeChange(this.pool, "UPDATE tag_types SET name = ?, color = ? WHERE id = ?", [typeName, color, id]);

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

    await executeChange(this.pool, "DELETE FROM tag_types WHERE id = ?", [id]);
  }

  async setVideoTags(videoId: string, tagNames: string[]): Promise<void> {
    const video = await this.findVideo(videoId);

    if (video === null) {
      throw new Error(`Video not found: ${videoId}`);
    }

    await this.withTransaction(async (connection) => {
      await executeChange(connection, "DELETE FROM video_tags WHERE video_id = ?", [videoId]);

      for (const [position, tagName] of tagNames.entries()) {
        const tag = await this.upsertTagOn(connection, tagName);

        await executeChange(connection, "INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)", [
          videoId,
          tag.id,
          position,
        ]);
      }
    });
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

    await this.withTransaction(async (connection) => {
      const tag = await this.upsertTagOn(connection, tagName);
      const nextPosition = await nextVideoTagPosition(connection, videoId);

      await executeChange(connection, "INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)", [
        videoId,
        tag.id,
        nextPosition,
      ]);
    });
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

    await executeChange(this.pool, "DELETE FROM video_tags WHERE video_id = ? AND tag_id = ?", [videoId, tag.id]);
  }

  async getVideoTags(videoId: string): Promise<string[]> {
    const rows = await queryRows(
      this.pool,
      `
        SELECT tags.name AS name
        FROM video_tags
        INNER JOIN tags ON tags.id = video_tags.tag_id
        INNER JOIN tag_types ON tag_types.id = tags.tag_type_id
        WHERE video_tags.video_id = ?
        ORDER BY tag_types.sort_order ASC, LOWER(tags.name) ASC
      `,
      [videoId],
    );

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

  private async findTagTypeByName(name: string): Promise<LibraryTagType | null> {
    const row = await queryOne(
      this.pool,
      `${TAG_TYPE_SELECT} WHERE tag_types.name = ? GROUP BY tag_types.id, tag_types.name, tag_types.color, tag_types.is_default, tag_types.sort_order`,
      [name],
    );

    return isTagTypeRow(row) ? toLibraryTagType(row) : null;
  }

  private async requireDefaultTagType(): Promise<LibraryTagType> {
    const defaultType = await this.findDefaultTagType();

    if (defaultType === null) {
      throw new Error("Default tag type is missing");
    }

    return defaultType;
  }

  private async upsertTagOn(executor: SqlExecutor, name: string): Promise<LibraryTag> {
    const tagName = requireNonEmpty(name, "Tag name");
    const defaultType = await this.requireDefaultTagType();

    await executeChange(executor, "INSERT IGNORE INTO tags (name, tag_type_id) VALUES (?, ?)", [
      tagName,
      defaultType.id,
    ]);

    const row = await queryOne(executor, `${TAG_SELECT} WHERE tags.name = ?`, [tagName]);

    if (!isTagRow(row)) {
      throw new Error(`Unable to persist tag ${tagName}`);
    }

    return toLibraryTag(row);
  }

  private async withTransaction(work: (connection: PoolConnection) => Promise<void>): Promise<void> {
    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      await work(connection);
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

function requireNonEmpty(value: string, label: string): string {
  if (value.length === 0) {
    throw new Error(`${label} must not be empty`);
  }

  return value;
}

async function nextVideoTagPosition(executor: SqlExecutor, videoId: string): Promise<number> {
  const row = await queryOne(executor, "SELECT MAX(position) AS position FROM video_tags WHERE video_id = ?", [
    videoId,
  ]);

  if (!isPositionRow(row) || row.position === null) {
    return 0;
  }

  return Number(row.position) + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVideoRow(value: unknown): value is RowDataPacket & { id: string } {
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
  isDefault: number | bigint | Buffer;
  sortOrder: number | bigint;
  tagCount: number | bigint;
}

function isTagRow(value: unknown): value is TagRow {
  return (
    isRecord(value) &&
    isIntegerValue(value.id) &&
    typeof value.name === "string" &&
    isIntegerValue(value.typeId) &&
    typeof value.typeName === "string" &&
    typeof value.color === "string" &&
    isIntegerValue(value.typeSortOrder)
  );
}

function isNameRow(value: unknown): value is { name: string } {
  return isRecord(value) && typeof value.name === "string";
}

function isTagUsageRow(value: unknown): value is TagUsageRow {
  return isTagRow(value) && isRecord(value) && isIntegerValue(value.usageCount);
}

function isTagTypeRow(value: unknown): value is TagTypeRow {
  return (
    isRecord(value) &&
    isIntegerValue(value.id) &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    isIntegerValue(value.isDefault) &&
    isIntegerValue(value.sortOrder) &&
    isIntegerValue(value.tagCount)
  );
}

function isSortOrderRow(value: unknown): value is { sortOrder: number | bigint | null } {
  return isRecord(value) && (value.sortOrder === null || isIntegerValue(value.sortOrder));
}

function isPositionRow(value: unknown): value is { position: number | bigint | null } {
  return isRecord(value) && (value.position === null || isIntegerValue(value.position));
}

function isIntegerValue(value: unknown): value is number | bigint {
  return typeof value === "number" || typeof value === "bigint";
}

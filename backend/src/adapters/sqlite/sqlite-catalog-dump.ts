import { DatabaseSync } from "node:sqlite";

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

function asRecords(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
}

import { Buffer } from "node:buffer";
import type { Pool, RowDataPacket } from "mysql2/promise";

import type { SqliteCatalogDump } from "../sqlite/sqlite-catalog-dump.js";
import { queryRows } from "./mariadb-sql.js";

export async function readMariadbCatalogDump(pool: Pool): Promise<SqliteCatalogDump> {
  return {
    tagTypes: asRecords(
      await queryRows(pool, "SELECT id, name, color, is_default, sort_order FROM tag_types ORDER BY id"),
    ),
    tags: asRecords(await queryRows(pool, "SELECT id, name, tag_type_id FROM tags ORDER BY id")),
    videos: asRecords(await queryRows(pool, "SELECT id, recorded_at FROM videos ORDER BY id")),
    videoTags: asRecords(
      await queryRows(pool, "SELECT video_id, tag_id, position FROM video_tags ORDER BY video_id, position"),
    ),
    users: asRecords(
      await queryRows(pool, "SELECT id, username, password_hash, role, created_at FROM users ORDER BY id"),
    ),
  };
}

function asRecords(rows: RowDataPacket[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const record: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      record[key] = normalizeDumpValue(value);
    }

    return record;
  });
}

function normalizeDumpValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  return value;
}

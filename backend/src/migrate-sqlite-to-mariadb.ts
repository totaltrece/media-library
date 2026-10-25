import type { Pool } from "mysql2/promise";

import { openMariadbStores } from "./adapters/mariadb/open-mariadb-stores.js";
import { executeChange, queryOne, queryRows } from "./adapters/mariadb/mariadb-sql.js";
import {
  findSqliteCatalogIntegrityIssues,
  readSqliteCatalogDump,
  type SqliteCatalogDump,
} from "./adapters/sqlite/sqlite-catalog-dump.js";
import { config } from "./config.js";

interface CliOptions {
  dryRun: boolean;
  force: boolean;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (config.database.engine !== "mariadb") {
    throw new Error("DATABASE_ENGINE must be mariadb to run this importer.");
  }

  const sqlitePath = config.database.sqlitePath ?? config.sqlitePath;

  if (sqlitePath === undefined) {
    throw new Error("SQLITE_PATH is required as the read-only SQLite source.");
  }

  const dump = readSqliteCatalogDump(sqlitePath);
  const issues = findSqliteCatalogIntegrityIssues(dump);

  console.log(`SQLite source: ${sqlitePath}`);
  console.log(`MariaDB target: ${config.database.host}:${config.database.port}/${config.database.database}`);
  console.log("");
  printCounts("SQLite", dump);

  if (issues.length > 0) {
    console.error("");
    console.error("Integrity issues:");

    for (const issue of issues) {
      console.error(`- ${issue}`);
    }

    process.exitCode = 1;
    return;
  }

  if (options.dryRun) {
    console.log("");
    console.log("Dry-run only. Sessions are not copied.");
    return;
  }

  const stores = await openMariadbStores(config.database);

  try {
    const existingVideos = await queryOne(stores.pool, "SELECT COUNT(*) AS count FROM videos");
    const existingCount = Number(existingVideos?.count ?? 0);

    if (existingCount > 0 && !options.force) {
      throw new Error(`MariaDB already has ${existingCount} videos. Re-run with --force to replace catalog rows.`);
    }

    await importDump(stores.pool, dump);

    const imported: SqliteCatalogDump = {
      tagTypes: await queryRows(stores.pool, "SELECT id, name, color, is_default, sort_order FROM tag_types ORDER BY id"),
      tags: await queryRows(stores.pool, "SELECT id, name, tag_type_id FROM tags ORDER BY id"),
      videos: await queryRows(stores.pool, "SELECT id, recorded_at FROM videos ORDER BY id"),
      videoTags: await queryRows(
        stores.pool,
        "SELECT video_id, tag_id, position FROM video_tags ORDER BY video_id, position",
      ),
      users: await queryRows(stores.pool, "SELECT id, username, role FROM users ORDER BY id"),
    };

    console.log("");
    printCounts("MariaDB", imported);

    if (
      imported.tagTypes.length !== dump.tagTypes.length ||
      imported.tags.length !== dump.tags.length ||
      imported.videos.length !== dump.videos.length ||
      imported.videoTags.length !== dump.videoTags.length ||
      imported.users.length !== dump.users.length
    ) {
      throw new Error("Imported row counts do not match the SQLite source.");
    }

    console.log("");
    console.log("Import complete. Sessions were not copied; users must sign in again.");
  } finally {
    await stores.close();
  }
}

async function importDump(pool: Pool, dump: SqliteCatalogDump): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await executeChange(connection, "SET FOREIGN_KEY_CHECKS = 0");
    await executeChange(connection, "DELETE FROM video_tags");
    await executeChange(connection, "DELETE FROM tags");
    await executeChange(connection, "DELETE FROM videos");
    await executeChange(connection, "DELETE FROM sessions");
    await executeChange(connection, "DELETE FROM users");
    await executeChange(connection, "DELETE FROM tag_types");

    for (const row of dump.tagTypes) {
      await executeChange(
        connection,
        "INSERT INTO tag_types (id, name, color, is_default, sort_order) VALUES (?, ?, ?, ?, ?)",
        [row.id, row.name, row.color, row.is_default, row.sort_order],
      );
    }

    for (const row of dump.tags) {
      await executeChange(connection, "INSERT INTO tags (id, name, tag_type_id) VALUES (?, ?, ?)", [
        row.id,
        row.name,
        row.tag_type_id,
      ]);
    }

    for (const row of dump.videos) {
      await executeChange(connection, "INSERT INTO videos (id, recorded_at) VALUES (?, ?)", [row.id, row.recorded_at]);
    }

    for (const row of dump.videoTags) {
      await executeChange(connection, "INSERT INTO video_tags (video_id, tag_id, position) VALUES (?, ?, ?)", [
        row.video_id,
        row.tag_id,
        row.position,
      ]);
    }

    for (const row of dump.users) {
      await executeChange(
        connection,
        "INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)",
        [row.id, row.username, row.password_hash, row.role, row.created_at],
      );
    }

    await executeChange(connection, "SET FOREIGN_KEY_CHECKS = 1");
    await connection.commit();
  } catch (error: unknown) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function printCounts(label: string, dump: Pick<SqliteCatalogDump, "tagTypes" | "tags" | "videos" | "videoTags" | "users">): void {
  console.log(`${label} tag types: ${dump.tagTypes.length}`);
  console.log(`${label} tags:      ${dump.tags.length}`);
  console.log(`${label} videos:    ${dump.videos.length}`);
  console.log(`${label} relations: ${dump.videoTags.length}`);
  console.log(`${label} users:     ${dump.users.length}`);
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Set<string>();

  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--force" || arg === "--help" || arg === "-h") {
      flags.add(arg);
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (flags.has("--help") || flags.has("-h")) {
    printHelp();
    process.exit(0);
  }

  return {
    dryRun: flags.has("--dry-run"),
    force: flags.has("--force"),
  };
}

function printHelp(): void {
  console.log("Usage: pnpm --filter @media-library/backend migrate-sqlite-to-mariadb -- [--dry-run] [--force]");
  console.log("");
  console.log("Copies catalog and user rows from SQLITE_PATH into MariaDB. Sessions are not copied.");
  console.log("Does not read or write TagSpaces sidecars or media files.");
}

void main();

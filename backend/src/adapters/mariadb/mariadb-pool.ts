import { createPool, type Pool } from "mysql2/promise";

import type { MariadbDatabaseConfig } from "../../application/database-config.js";
import { mariadbMigrations } from "./migrations.js";
import { executeChange, queryRows } from "./mariadb-sql.js";

export function createMariadbPool(config: MariadbDatabaseConfig): Pool {
  const pool = createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 10_000,
    charset: "utf8mb4_bin",
    dateStrings: true,
    timezone: "Z",
  });

  pool.on("connection", (connection) => {
    connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_bin");
  });

  return pool;
}

export async function applyMariadbMigrations(pool: Pool): Promise<void> {
  await executeChange(
    pool,
    `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT NOT NULL,
        applied_at VARCHAR(64) NOT NULL,
        PRIMARY KEY (version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
    `,
  );

  const applied = new Set(
    (await queryRows(pool, "SELECT version FROM schema_migrations")).map((row) => Number(row.version)),
  );

  for (const migration of mariadbMigrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const statement of migration.statements) {
        await executeChange(connection, statement);
      }

      await executeChange(connection, "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [
        migration.version,
        new Date().toISOString(),
      ]);
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

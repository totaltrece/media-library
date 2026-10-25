import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

export type SqlExecutor = Pool | PoolConnection;

interface Executable {
  execute(sql: string, params?: unknown[]): Promise<[unknown, unknown]>;
}

function executable(executor: SqlExecutor): Executable {
  return executor as unknown as Executable;
}

export async function queryRows(executor: SqlExecutor, sql: string, params: unknown[] = []): Promise<RowDataPacket[]> {
  const [rows] = await executable(executor).execute(sql, params);

  if (!Array.isArray(rows)) {
    throw new Error("Expected a row set from MariaDB");
  }

  return rows as RowDataPacket[];
}

export async function queryOne(executor: SqlExecutor, sql: string, params: unknown[] = []): Promise<RowDataPacket | null> {
  const rows = await queryRows(executor, sql, params);

  return rows[0] ?? null;
}

export async function executeChange(
  executor: SqlExecutor,
  sql: string,
  params: unknown[] = [],
): Promise<ResultSetHeader> {
  const [result] = await executable(executor).execute(sql, params);

  return result as ResultSetHeader;
}

export function isUniqueViolation(error: unknown): boolean {
  return isMysqlError(error) && error.errno === 1062;
}

function isMysqlError(error: unknown): error is { errno: number } {
  return typeof error === "object" && error !== null && "errno" in error && typeof error.errno === "number";
}

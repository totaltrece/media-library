import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

import { parseDatabaseConfig } from "./application/database-config.js";
import { resolveUploadProcessingConfig } from "./application/resolve-upload-processing-config.js";

loadBackendEnv();

function loadBackendEnv(): void {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const envPath = [join(moduleDirectory, "..", ".env"), join(moduleDirectory, "..", "..", ".env")].find(
    (candidate) => existsSync(candidate),
  );

  if (envPath !== undefined) {
    loadEnv({ path: envPath });
    return;
  }

  loadEnv();
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
}

const database = parseDatabaseConfig(process.env);
const sqlitePath = database.sqlitePath;

export const config = {
  libraryPath: requireEnv("LIBRARY_PATH"),
  port: Number(process.env.PORT ?? "3000"),
  database,
  sqlitePath,
  authPublicRead: process.env.AUTH_PUBLIC_READ !== "false",
  indexReloadIntervalMs: readNonNegativeInteger(process.env.INDEX_RELOAD_INTERVAL_MS, 60_000, "INDEX_RELOAD_INTERVAL_MS"),
  ...resolveUploadProcessingConfig(process.env, { sqlitePath }),
};

function readNonNegativeInteger(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsed;
}

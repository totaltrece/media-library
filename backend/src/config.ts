import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

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

const sqlitePath = requireEnv("SQLITE_PATH");

export const config = {
  libraryPath: requireEnv("LIBRARY_PATH"),
  port: Number(process.env.PORT ?? "3000"),
  sqlitePath,
  ...resolveUploadProcessingConfig(process.env, { sqlitePath }),
};

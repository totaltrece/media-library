export type DatabaseEngine = "sqlite" | "mariadb";

export interface SqliteDatabaseConfig {
  engine: "sqlite";
  sqlitePath: string;
}

export interface MariadbDatabaseConfig {
  engine: "mariadb";
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  sqlitePath?: string;
}

export type DatabaseConfig = SqliteDatabaseConfig | MariadbDatabaseConfig;

export function parseDatabaseConfig(env: NodeJS.Dict<string>): DatabaseConfig {
  const engine = (env.DATABASE_ENGINE ?? "sqlite").trim().toLowerCase();

  if (engine !== "sqlite" && engine !== "mariadb") {
    throw new Error("DATABASE_ENGINE must be sqlite or mariadb.");
  }

  if (engine === "sqlite") {
    return {
      engine: "sqlite",
      sqlitePath: requireEnv(env, "SQLITE_PATH"),
    };
  }

  const sqlitePath = readOptional(env.SQLITE_PATH);

  return {
    engine: "mariadb",
    host: requireEnv(env, "MARIADB_HOST"),
    port: readPort(env.MARIADB_PORT),
    database: requireEnv(env, "MARIADB_DATABASE"),
    user: requireEnv(env, "MARIADB_USER"),
    password: requireEnv(env, "MARIADB_PASSWORD"),
    ...(sqlitePath !== undefined ? { sqlitePath } : {}),
  };
}

function requireEnv(env: NodeJS.Dict<string>, name: string): string {
  const value = readOptional(env[name]);

  if (value === undefined) {
    throw new Error(`${name} environment variable is required.`);
  }

  return value;
}

function readOptional(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function readPort(value: string | undefined): number {
  const trimmed = readOptional(value);

  if (trimmed === undefined) {
    return 3306;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("MARIADB_PORT must be a positive integer.");
  }

  return parsed;
}

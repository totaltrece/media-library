import assert from "node:assert/strict";
import { test } from "node:test";

import { parseDatabaseConfig } from "../src/application/database-config.js";

test("parseDatabaseConfig defaults to sqlite and requires SQLITE_PATH", () => {
  assert.deepEqual(parseDatabaseConfig({ SQLITE_PATH: "data/library.sqlite" }), {
    engine: "sqlite",
    sqlitePath: "data/library.sqlite",
  });
  assert.throws(() => parseDatabaseConfig({}), /SQLITE_PATH environment variable is required/);
});

test("parseDatabaseConfig rejects an unknown engine", () => {
  assert.throws(
    () => parseDatabaseConfig({ DATABASE_ENGINE: "postgres", SQLITE_PATH: "data/library.sqlite" }),
    /DATABASE_ENGINE must be sqlite or mariadb/,
  );
});

test("parseDatabaseConfig requires MariaDB connection fields and defaults the port", () => {
  assert.throws(
    () => parseDatabaseConfig({ DATABASE_ENGINE: "mariadb", MARIADB_HOST: "127.0.0.1" }),
    /MARIADB_DATABASE environment variable is required/,
  );
  assert.deepEqual(
    parseDatabaseConfig({
      DATABASE_ENGINE: "mariadb",
      MARIADB_HOST: "127.0.0.1",
      MARIADB_DATABASE: "media-library",
      MARIADB_USER: "media-library",
      MARIADB_PASSWORD: "secret",
      SQLITE_PATH: "data/library.sqlite",
    }),
    {
      engine: "mariadb",
      host: "127.0.0.1",
      port: 3306,
      database: "media-library",
      user: "media-library",
      password: "secret",
      sqlitePath: "data/library.sqlite",
    },
  );
});

test("parseDatabaseConfig rejects an invalid MariaDB port", () => {
  assert.throws(
    () =>
      parseDatabaseConfig({
        DATABASE_ENGINE: "mariadb",
        MARIADB_HOST: "127.0.0.1",
        MARIADB_PORT: "abc",
        MARIADB_DATABASE: "media-library",
        MARIADB_USER: "media-library",
        MARIADB_PASSWORD: "secret",
      }),
    /MARIADB_PORT must be a positive integer/,
  );
});

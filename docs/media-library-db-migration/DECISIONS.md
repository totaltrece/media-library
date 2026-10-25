# Decisions

## Engine flag

`DATABASE_ENGINE` is `sqlite` (default) or `mariadb`. SQLite is a fallback
during cutover, not a second live catalog to sync.

## Connector

Adapters use `mysql2` with a connection pool. Ports stay async; domain types
do not change.

## Collation

MariaDB tables use `utf8mb4_bin` so tag and username uniqueness matches
SQLite’s default binary comparison.

## Sessions

The importer does not copy `sessions`. Users sign in again after cutover.

## TagSpaces

MariaDB never reads or writes sidecars. Do not run `import-library` as part
of the data move.

## Shared in-memory index

Each API process keeps `InMemoryVideoIndex` and reloads it from `LibraryStore`
on `INDEX_RELOAD_INTERVAL_MS` (default 60 seconds). Set the value to `0` to
disable the timer. Writes in the same process still update the index immediately.

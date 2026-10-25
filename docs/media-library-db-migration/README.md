# MariaDB migration

This folder tracks the move from a single SQLite file to MariaDB for catalog
and auth metadata. Media files and TagSpaces sidecars stay read-only and are
not part of the target database.

## Status

| Milestone | Status |
|-----------|--------|
| M1 async ports | Done |
| M2 `DATABASE_ENGINE` | Done |
| M3 MariaDB adapters | Done |
| M4 SQLite importer | Done |
| M5 ops notes | Done |

SQLite remains a selectable engine. Cut over an environment by pointing
`DATABASE_ENGINE=mariadb` at one shared database after a successful import.

## Live MariaDB tests

Set `MEDIA_LIBRARY_MARIADB_TESTS=1` plus `MARIADB_HOST`, `MARIADB_PORT`,
`MARIADB_DATABASE`, `MARIADB_USER`, and `MARIADB_PASSWORD`. Those tests wipe
catalog tables. They refuse the production name `media-library` unless
`MEDIA_LIBRARY_MARIADB_ALLOW_PRODUCTION_RESET=1`. Use a dedicated test
database.

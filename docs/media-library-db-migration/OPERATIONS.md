# Operations

## Environment

Do not commit secrets. Example variables live in `backend/.env copy.example`.

SQLite:

```text
DATABASE_ENGINE=sqlite
SQLITE_PATH=C:\path\to\library.sqlite
AUTH_PUBLIC_READ=false
```

MariaDB (on the server, bind MariaDB to localhost):

```text
DATABASE_ENGINE=mariadb
MARIADB_HOST=127.0.0.1
MARIADB_PORT=3306
MARIADB_DATABASE=media-library
MARIADB_USER=media-library
MARIADB_PASSWORD=
SQLITE_PATH=C:\path\to\library.sqlite
UPLOAD_TEMP_PATH=C:\path\to\data\upload-temp
AUTH_PUBLIC_READ=false
INDEX_RELOAD_INTERVAL_MS=60000
```

Keep `SQLITE_PATH` while running the importer. After cutover it is optional.

From Windows, open an SSH tunnel and set `MARIADB_HOST=127.0.0.1`. Do not
publish MariaDB on `0.0.0.0`.

```text
ssh -N -L 3306:127.0.0.1:3306 user@server
```

## Import

1. Copy `library.sqlite` (and WAL/SHM if present). Keep that copy as rollback.
2. Confirm the target database is empty, or accept `--force` replacement.
3. Dry-run:

   `pnpm --filter @media-library/backend migrate-sqlite-to-mariadb -- --dry-run`

4. Import:

   `pnpm --filter @media-library/backend migrate-sqlite-to-mariadb --`

5. Compare printed counts. Sign in with an existing user. Search a known video.

## Backup after cutover

Keep rsync of media files. Replace SQLite-file backup with `mariadb-dump` of
the `media-library` database. Keep the last SQLite file until a restore drill
succeeds.

Rollback: set `DATABASE_ENGINE=sqlite` and the original file path. Leave the
MariaDB copy unused.

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

Keep rsync of media files. From **Admin zone** (`/admin`), an admin can
write the live MariaDB catalog into `SQLITE_PATH` (tag types, tags, videos,
relations, users; not sessions). That SQLite file is a snapshot, not the
live database while `DATABASE_ENGINE=mariadb`. The same page is a no-op
(HTTP 409) when `DATABASE_ENGINE=sqlite`.

You can still take a `mariadb-dump` of the `media-library` database as a
server-side backup.

Rollback: set `DATABASE_ENGINE=sqlite` and the SQLite file path. Leave the
MariaDB copy unused.

## Windows / WSL pull from the server

Run from Windows:

```text
wsl ~/backup-media-library.sh
```

That wrapper executes `tools/backup-media-library.sh`. Shell scripts in
`tools/` must stay Unix (`LF`) line endings. `.gitattributes` sets
`*.sh text eol=lf` so a Windows checkout does not break the shebang
(`/bin/bash^M`).

The OpenSSH “post-quantum key exchange” line is a warning only.

What it copies:

| Source (server) | Destination |
| --- | --- |
| `/mnt/storage/media-library/videos/` | `LIBRARY_PATH` (`C:\Users\Carlos\Documents\baile`) and, if present, `D:\baile` |
| `videos/.ts/` | `.ts/` next to those video folders |
| `/mnt/storage/media-library/db/library.sqlite` | `SQLITE_PATH` from `backend/.env` (the file the local app uses in sqlite mode), plus `D:\baile\db\library.sqlite` |

Video rsync excludes `db/` and `*.sqlite`. `tools/sync-baile.sh` uses the
same exclude so a catalog file next to the videos is not uploaded into
`videos/` on the server.

SQLite is downloaded to WSL `/tmp` first, then copied into place. A
straight `mv` onto `/mnt/d` often fails with `Permission denied` (drvfs /
file in use). Close the local app if it has `SQLITE_PATH` open, and close
Explorer windows on `D:\baile\db\library.sqlite`, if a copy still fails.

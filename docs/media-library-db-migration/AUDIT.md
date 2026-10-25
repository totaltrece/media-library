# Architectural audit: SQLite → MariaDB

**Scope:** read-only inspection of `totaltrece/media-library`.  
**Legend:** **Fact** = verified in code. **Inference** = reasonable from code/docs. **Needs confirmation** = not in the repository.

This document records an analysis-only audit. It does not authorize implementation.

## Clarifications (2026-10-25)

These items update the audit. They do not reopen the full investigation.

1. **Authentication.** Catalog queries require a signed-in user because
   deployed environments set `AUTH_PUBLIC_READ=false`. That is the existing
   policy flag, not a new auth system. Roles `view` (read) and `admin`
   (read + write) are in use. Users are created with `create-user`
   (`--role admin|view`). The frontend first screen is an access-restricted
   notice until sign-in (`frontend/src/App.vue`). Do not change
   `auth-policy` or user management as part of MariaDB work. Canonical
   write-up: `docs/media-library-auth-development/`.
2. **TagSpaces.** Out of the target architecture. MariaDB must not read or
   write sidecars. Keep retiring leftover runtime paths already listed in
   section 5 (thumbnail `.ts/` layout, `indexLibrary`, `import-library`)
   without expanding MariaDB scope. Do not re-run TagSpaces import as part
   of the data move.
3. **Shared in-memory index.** Keep it simple. Local writes are infrequent.
   Reload `InMemoryVideoIndex` from `LibraryStore` on a coarse interval (and
   keep the existing in-process updates after local writes). No version
   table, pub/sub, or per-request full reload.

---

## 1. Executive summary

The hexagonal split is already in place for metadata: use cases talk to `LibraryStore` and `AuthStore`, not to SQL. Durable state lives in **one SQLite file** opened with Node’s built-in `node:sqlite` / `DatabaseSync`. Library and auth share that connection. There is **no MariaDB/MySQL client, schema, or env contract** today.

A MariaDB adapter can implement the same ports now that they are **async**
(M1). SQLite still uses `DatabaseSync` behind `async` adapter methods.
`mysql2` (or the official MariaDB connector) is async; wrapping it in a
blocking API would be a worse leak than changing the ports.

The important product constraints are already aligned with a **single central MariaDB**:

- Tag edits go only to the database (not to TagSpaces sidecars).
- `SyncNewVideosUseCase` inserts videos **without** reading TagSpaces tags.
- Two app processes can share one MariaDB **for metadata**, but each process still keeps an **in-memory video index**. Writes on one instance will not update search/browse on the other until that index is reloaded. That is a real gap for “PC + Plesk, same DB”.

TagSpaces is **not** the source of truth for tags anymore, but it is still in the **runtime path for thumbnails**, in a **historical import CLI**, in `packages/indexer`, and in a large amount of documentation (including `AGENTS.md`).

HTTP auth is **policy in the application layer**, not in SQL. If
`AUTH_PUBLIC_READ` is omitted, code still defaults to public GET. **Deployed
environments set `AUTH_PUBLIC_READ=false`**, so catalog GET requires `view`
or `admin`. The MariaDB migration must not change that flag or the guard.

**Recommendation:** keep SQLite as a selectable engine; add MariaDB adapters behind the same ports; make ports async; migrate data once; point both environments at one MariaDB reached locally on the server and via SSH tunnel (or VPN) from Windows. Do not expose MariaDB to the internet. Do not keep two live databases to sync.

---

## 2. Current architecture (verified)

### 2.1 Persistence ports

**`LibraryStore`** — `backend/src/ports/library-store.ts`

| Method | Role |
|--------|------|
| `initialize()` / `close()` | Schema/lifecycle. `initialize()` exists on the port; production open path runs migrations in `openSqliteDatabase()`, not via `initialize()`. |
| `upsertVideo` / `findVideo` / `listVideos` / `deleteVideo` / `setVideoRecordedAt` | Videos. PK is `id` (string media id). `recorded_at` is ISO text or null. Upsert **keeps** an existing `recorded_at` (`COALESCE`). |
| `upsertTag` / `findTagById` / `findTagByName` / `listTags` / `listTagUsages` / `updateTag` / `deleteTag` | Tags. Numeric ids. Unique **name**. New tags get the **default tag type**. |
| `listTagTypes` / `findTagTypeById` / `findDefaultTagType` / `createTagType` / `updateTagType` / `deleteTagType` | Tag types: name, color, `isDefault`, `sortOrder`, `tagCount`. Default type cannot be deleted; types in use cannot be deleted. |
| `setVideoTags` / `addVideoTag` / `removeVideoTag` / `getVideoTags` / `listVideosWithTags` | Relations + **per-video tag order** (`video_tags.position`). `getVideoTags` orders by **type `sort_order`**, then **name `COLLATE NOCASE`**. |

Only implementation: `SqliteLibraryStore`.

**`AuthStore`** — `backend/src/ports/auth-store.ts`

| Method | Role |
|--------|------|
| `createUser` | Insert user; unique username; roles `admin` \| `view`. |
| `findUserByUsername` | Returns hash (`AuthUserRecord`). |
| `findUserById` | Public user (no hash). |
| `createSession` / `findValidSession` / `deleteSession` | Opaque token, expiry compared as ISO strings. |

Only implementation: `SqliteAuthStore`.

**Not SQLite (and not in this migration):**

| Port | Adapter | Notes |
|------|---------|--------|
| `LibraryIndexer` | `SqliteLibraryIndexer`, `WorkspaceLibraryIndexer` | SQLite indexer only calls `listVideosWithTags()`. Workspace indexer still reads TagSpaces JSON. |
| `VideoDiscovery` | `WorkspaceVideoDiscovery` | Filesystem scan via `@media-library/indexer` `discoverVideoPaths`. |
| `VideoStore` / `ThumbnailStore` | Filesystem / `TagSpacesThumbnailStore` | Media + `.ts/*.jpg`. |
| `ProcessingJobStore` | `InMemoryProcessingJobStore` | Upload jobs are **not** durable. |
| `VideoIndex` | `InMemoryVideoIndex` | Search cache, loaded at process start. |

### 2.2 Composition and lifecycle

`backend/src/main.ts`:

1. `openSqliteStores(config.sqlitePath)`
2. `libraryStore.listVideosWithTags()` → `InMemoryVideoIndex`
3. `createApp({ libraryStore, authStore, authPublicRead, ... })`
4. Fastify `onClose` → `stores.close()`; startup failure also closes.

CLIs:

- `backend/src/import-library.ts` → `openSqliteLibraryStore` (library only)
- `backend/src/backfill-recorded-at.ts` → same
- `backend/src/create-user.ts` → `openSqliteStores` (shared DB)

`createApp` (`backend/src/app.ts`) depends on **port types**. Auth is wired only if `authStore` is passed. The guard is a Fastify `preHandler` on the `/api` plugin.

### 2.3 Transactions (encapsulated in adapters)

| Location | Atomicity |
|----------|-----------|
| `applySqliteMigrations` | One transaction per pending version + `schema_migrations` insert. |
| `SqliteLibraryStore.setVideoTags` | `BEGIN` → delete relations → upsert tags + insert `(video_id, tag_id, position)` → `COMMIT`; `ROLLBACK` on error. |
| `SqliteLibraryStore.addVideoTag` | Same for upsert tag + insert relation. |
| `removeVideoTag`, tag/type CRUD, auth | Single statements; no multi-statement transaction. |

Use cases do **not** open transactions. That is the right place for MariaDB as well.

**Gap:** `ImportLibraryUseCase` loops `upsertVideo` + `setVideoTags` **per video** with no whole-import transaction. A crash can leave a partial import. Acceptable if the importer is idempotent (it largely is).

### 2.4 Migrations

`backend/src/adapters/sqlite/migrations.ts` + `applySqliteMigrations` in `sqlite-library-store.ts`.

Ledger (created by the runner, not by v1):

```sql
schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT
```

| Version | Content |
|---------|---------|
| 1 | `videos`, `tags`, `video_tags` (`position`, PK `(video_id, tag_id)`, UNIQUE `(video_id, position)`), FKs `ON DELETE CASCADE` |
| 2 | `videos.recorded_at TEXT` |
| 3 | `tag_types` + seed ids 1–5 (`resource` is default id 5); rebuild `tags` with `tag_type_id`; name-based classification via `lower(name)` |
| 4 | `users`, `sessions`, indexes `sessions_user_id`, `sessions_expires_at` |

Runner: `PRAGMA foreign_keys = OFF` during apply, then `ON`.

### 2.5 Config

`backend/src/config.ts`:

- Required: `LIBRARY_PATH`, `SQLITE_PATH`
- `AUTH_PUBLIC_READ !== "false"` → public read (default **on**)
- Upload temp defaults to `dirname(SQLITE_PATH)/upload-temp`

Example: `backend/.env copy.example` (commented `# AUTH_PUBLIC_READ=false`).

---

## 3. SQLite dependencies found

### Inside adapters (expected)

- `backend/src/adapters/sqlite/sqlite-library-store.ts` — `DatabaseSync`, `ON CONFLICT`, `excluded.`, `COLLATE NOCASE`, `lastInsertRowid`, `BEGIN`/`COMMIT`/`ROLLBACK`, `PRAGMA`
- `backend/src/adapters/sqlite/sqlite-auth-store.ts` — `DatabaseSync`; unique errors via `/unique/i` on `error.message`
- `backend/src/adapters/sqlite/migrations.ts` — `STRICT`, `AUTOINCREMENT`, SQLite `ALTER` rebuild for v3

### Outside adapters (coupling)

| Location | Coupling |
|----------|----------|
| `backend/src/main.ts`, `import-library.ts`, `backfill-recorded-at.ts`, `create-user.ts` | Import SQLite factories |
| `backend/src/config.ts` | `SQLITE_PATH` required even conceptually for non-SQLite |
| `resolve-upload-processing-config.ts` | Temp dir derived from SQLite file path |
| `backend/package.json` | `create-user` CLI |
| `tools/backup-media-library.sh` | rsync of `library.sqlite` as metadata backup |
| Docs / `AGENTS.md` | SQLite + TagSpaces as product language |
| Tests | `:memory:` SQLite as the default “real” store |

**Not found:** `mysql`, `mariadb`, `better-sqlite3`. Persistence is **only** `node:sqlite`.

### SQL that does **not** port 1:1

| SQLite | MariaDB |
|--------|---------|
| `STRICT` | Drop |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `INT/BIGINT AUTO_INCREMENT` |
| `ON CONFLICT(id) DO UPDATE SET ... excluded.` | `ON DUPLICATE KEY UPDATE recorded_at = COALESCE(videos.recorded_at, VALUES(recorded_at))` (or MariaDB 10.3+ alias) |
| `ON CONFLICT(name) DO NOTHING` | `INSERT IGNORE` or dummy `ON DUPLICATE KEY UPDATE name = name` |
| `COLLATE NOCASE` | Explicit `utf8mb4_unicode_ci` (or `LOWER()` in `ORDER BY` only — uniqueness is a separate decision) |
| `PRAGMA foreign_keys` | `FOREIGN_KEY_CHECKS`; InnoDB FKs are real |
| `lastInsertRowid` | `insertId` |
| `DatabaseSync` sync API | async pool + per-transaction connection |
| Default TEXT uniqueness = **binary** | Typical MariaDB collation is **case-insensitive** |

Queries that are otherwise portable: simple `SELECT`/`UPDATE`/`DELETE`, joins in `TAG_SELECT` / tag usages, ISO text dates, `?` placeholders (`mysql2` uses `?` as well).

`listTagTypes` uses `GROUP BY tag_types.id`. That is valid in SQLite and on MariaDB when `id` is the primary key (functional dependency). Prefer grouping by all selected non-aggregates if `sql_mode` is conservative.

`listVideosWithTags()` is **N+1** (`getVideoTags` per video). Same contract on MariaDB; a single join is an adapter-internal optimization, not a port change.

---

## 4. Auth persistence and HTTP auth

### 4.1 Schema and security guarantees to keep

**Fact — tables (migration v4):**

- `users`: `id`, `username` UNIQUE, `password_hash`, `role CHECK ('admin','view')`, `created_at` ISO text
- `sessions`: `token` PK, `user_id` FK cascade, `created_at`, `expires_at`
- Indexes on `user_id` and `expires_at`

**Fact — hashing:** `backend/src/application/password-hash.ts` — scrypt, format `scrypt$N$r$p$saltHex$derivedHex`. Never store plaintext. **Migrate hashes as opaque strings.**

**Fact — sessions:** `createSessionToken()` = 32 random bytes hex (`backend/src/application/session-token.ts`). Cookie `media_library_session`, httpOnly, `SameSite=Lax`, `path=/` (`auth-controller.ts`). Lifetime 30 days. Logout deletes the row. `findValidSession` requires `expires_at > now` ISO.

**Fact — shared connection:** `openSqliteStores` uses **one** `DatabaseSync` for library + auth.

**Fact — no user seed in SQL.** Users come from CLI `CreateUserUseCase`
(`create-user`). Tests use the same use case.

Auth operations that need transactions: **none** in the current adapter (single inserts). Username uniqueness is enforced in the use case **and** by UNIQUE (adapter maps unique failure to a generic `Error`, use case prefers `UsernameConflictError` via pre-check).

### 4.2 HTTP authorization (independent of the engine)

**Fact:** `authorizeRequest` / `canRead` / `canWrite` in `backend/src/application/auth-policy.ts`. Guard: `createAuthGuard` in `backend/src/adapters/http/auth-guard.ts`. Persistence is only used to **resolve the session**.

| Traffic | Rule |
|---------|------|
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | Exempt |
| GET/HEAD/OPTIONS | Allowed if `publicRead` **or** role `admin`/`view` |
| Other methods | `admin` only; anonymous → 401; other roles → 403 |

`GET /api/health` (and HEAD) is exempt so it can be used as an unauthenticated ping when public-read is off.

**Current product vs code default:**

- Deployed setting: `AUTH_PUBLIC_READ=false` (confirmed by operators).
- Code default if the variable is omitted: public GET (`config.ts`).
- Tests cover both modes, including `"GET requires a session when public-read is off"`.
- Frontend gates the catalog until `canView` is true.

Do not change `authPublicRead` defaulting or the guard during the database
migration. Operators must keep `AUTH_PUBLIC_READ=false` in environment
files (not committed).

Cookie has **no `secure` flag** (relevant on HTTPS/Plesk; out of scope unless you want it in the same programme).

### 4.3 Tests that lock current auth behaviour

- `backend/test/auth.test.ts` — login cookie, 401/403 writes, public GET, `publicRead: false`, `view` role
- `backend/test/sqlite-auth-store.test.ts` — hash, unique username, session expiry
- `backend/package.json` `test` only runs `health.test.js` and `auth.test.js` after `tsc`. Full adapter tests exist but are **not** in that script.

---

## 5. TagSpaces references still present

**Do not** design MariaDB to read/write TagSpaces. TagSpaces is out of the
target architecture. Treat the following leftover paths as cleanup
candidates only; do not expand MariaDB work to rename thumbnails or delete
`indexLibrary`.

### Active runtime (still used)

| Path | Role |
|------|------|
| `packages/indexer/src/index.ts` `indexLibrary` | Reads `.ts/<basename>.json` tag titles |
| `backend/src/adapters/indexer/workspace-library-indexer.ts` | Wraps `indexLibrary` |
| `backend/src/import-library.ts` + `ImportLibraryUseCase` | **Historical bulk import from sidecars** — still a shipped CLI (`pnpm import-library`) |
| `TagSpacesThumbnailStore`, `resolveLibraryThumbnailPath` | Thumbnails: `LIBRARY_PATH/.ts/<videoBasename>.jpg` |
| `EnsureLibraryMediaUseCase` | Generates **missing** JPGs in that layout (does not overwrite) |
| `app.ts` | Always constructs `TagSpacesThumbnailStore` |
| `tools/backup-media-library.sh` | rsync of `videos/.ts/` |

**Already independent of TagSpaces tags:**

- `SyncNewVideosUseCase` — discover files, `upsertVideo` only; tests state sidecars are **not** used for tags
- Runtime search/index — `SqliteLibraryIndexer` / `LibraryStore`
- Tag HTTP APIs — SQLite only

`discoverVideoPaths` in the indexer package is sidecar-free; only `indexLibrary` is not.

### Historical / misleading docs (do not delete in this task)

`AGENTS.md`, `docs/00-VISION.md`, `docs/02-backend.md`, `docs/03-api.md`, `docs/04-frontend.md`, `docs/05-indexing.md`, `docs/06-milestones.md`, `docs/07-development-rules.md`, `docs/media-library-sqlite-development/*` (M6 “retire TagSpaces”), `docs/media-library-auth-development/MILESTONES.md`, `docs/media-library-tag-types-development/*`, `docs/prompts/indexer.md`, tests named around TagSpaces (`import-library.test.ts`, `thumbnail.test.ts`, `sqlite-search.test.ts` import parity).

**Inference:** thumbnails still live in the TagSpaces **directory convention** even though tags do not. Renaming that layout is a **separate** filesystem/UI project, not required for MariaDB. Until then, MariaDB must not own thumbnail files.

---

## 6. Proposed MariaDB architecture

```text
HTTP / CLI
    → application (use cases, auth-policy)     [unchanged rules]
        → LibraryStore / AuthStore             [same methods, return Promise]
            → Sqlite*Store    if DATABASE_ENGINE=sqlite
            → Mariadb*Store   if DATABASE_ENGINE=mariadb
                → mysql2 pool → MariaDB (source of truth)
Filesystem adapters remain for videos + .ts thumbnails
In-memory index remains a cache of LibraryStore
```

### 6.1 Client: `mysql2`

**Recommend `mysql2` (promise API + pool).**

| Reason | Detail |
|--------|--------|
| MariaDB wire protocol | Compatible with Plesk MariaDB |
| Pool | Two app processes + HTTP concurrency; SQLite `DatabaseSync` is a single connection |
| Transactions | `connection.beginTransaction()` / `commit` / `rollback` on a **checked-out** connection (not on the pool object) |
| Placeholders | `?` like current SQL |
| Types | `@types/node` + `mysql2` types; `insertId`, `affectedRows` |
| Shutdown | `pool.end()` from Fastify `onClose` and CLI `finally` |

Official `mariadb` connector is a valid alternative; `mysql2` is the usual Node/TS choice and maps cleanly onto existing `?` SQL.

**Do not** put `mysql2` in use cases or controllers.

### 6.2 Async ports (required)

Change `LibraryStore` / `AuthStore` methods to `Promise<...>`. Keep SQLite implementations as `async` wrappers around `DatabaseSync`. Touch use cases and tests to `await`. This is the main application-layer change; it is not a domain-model change.

### 6.3 Engine selection and validation

Suggested env (names in English, values not committed):

```text
DATABASE_ENGINE=sqlite|mariadb   # required when both exist; fail on unknown
```

If `sqlite`: keep `SQLITE_PATH` (required).  
If `mariadb`:

```text
MARIADB_HOST=127.0.0.1
MARIADB_PORT=3306
MARIADB_USER=...
MARIADB_PASSWORD=...
MARIADB_DATABASE=...
MARIADB_CONNECTION_LIMIT=10
```

Startup: fail fast if engine is mariadb and any required field is missing; **do not** require `SQLITE_PATH` for MariaDB. Decouple `UPLOAD_TEMP_PATH` (already overridable).

Optional: `MARIADB_SSL` later — **not** needed for local socket/TCP on the server or for an SSH tunnel to localhost.

### 6.4 Schema on MariaDB (equivalent to SQLite v4, not a replay of v1–v3)

Ship **one** MariaDB baseline (InnoDB, `utf8mb4`) that matches the **current** logical model:

- `videos(id VARCHAR PK, recorded_at VARCHAR NULL)`
- `tag_types(...)` including seed rows **with the same ids 1–5**
- `tags(id PK AUTO_INCREMENT, name UNIQUE, tag_type_id FK)`
- `video_tags(video_id, tag_id, position, PK, UNIQUE(video_id, position), CASCADE)`
- `users`, `sessions` + indexes
- `schema_migrations`

Do **not** replay SQLite v3 table rebuild. Data copy is a **one-shot importer**, not `applySqliteMigrations` on MariaDB.

**Collation (decision):** SQLite tag/username uniqueness is case-sensitive. MariaDB `utf8mb4_unicode_ci` would merge `Salsa`/`salsa`. Recommend `utf8mb4_bin` (or `_unicode_ci` + generated binary unique) **unless** you confirm no case-only duplicates. Display order can still use a CI collation or `LOWER(name)` in `ORDER BY` to preserve `COLLATE NOCASE` behaviour in `getVideoTags`.

**Booleans:** keep `is_default` TINYINT 0/1 as today.

**Ids:** insert explicit integer ids on migration so relations survive; then set `AUTO_INCREMENT` to `MAX(id)+1`.

### 6.5 Two environments, one database

```text
[Plesk Node] --TCP 127.0.0.1:3306--> [MariaDB on same host]
[Windows Node] --app to 127.0.0.1:3306--> [ssh -L 3306:127.0.0.1:3306] --> server MariaDB
```

The app only knows `MARIADB_HOST=127.0.0.1`. SSH/VPN is **ops**, not application logic. **Needs confirmation:** MariaDB bind address and Plesk remote-access settings; do not assume a public port.

Shared DB does **not** share:

- `LIBRARY_PATH` (each machine’s video tree)
- in-memory `VideoIndex` (stale across processes)
- in-memory upload jobs

**Shared index (decided, keep it simple):** local catalog edits are infrequent.
Keep `InMemoryVideoIndex`. Reload it from `LibraryStore` on a coarse timer
(plus the existing in-process updates after local writes and
`POST /api/library/refresh`). Do not add a version counter, cache bus, or
per-request full catalog load.

### 6.6 Backups (replace SQLite file copy)

- Server: `mysqldump` / `mariadb-dump` (or Plesk scheduled dump) of the app database; keep dumps off-box.
- `tools/backup-media-library.sh` should **stop treating `library.sqlite` as the metadata source of truth**; keep rsync of videos + `.ts` thumbnails.
- Restore: dump → empty schema → import; app remains read-only toward media files.

---

## 7. File inventory (proposed; not done)

**Keep contracts (signatures may gain `Promise` only):**  
`backend/src/ports/library-store.ts`, `backend/src/ports/auth-store.ts`, `auth-policy.ts`, HTTP controllers.

**Create**

- `backend/src/adapters/mariadb/mariadb-pool.ts`
- `backend/src/adapters/mariadb/mariadb-library-store.ts`
- `backend/src/adapters/mariadb/mariadb-auth-store.ts`
- `backend/src/adapters/mariadb/migrations.ts` (MariaDB baseline)
- `backend/src/adapters/persistence/open-stores.ts` (engine switch)
- `backend/src/migrate-sqlite-to-mariadb.ts` (one-shot CLI)
- `backend/test/library-store.contract.ts`, `auth-store.contract.ts`
- `backend/test/mariadb-library-store.test.ts`, `mariadb-auth-store.test.ts` (guarded by env)
- `docs/media-library-db-migration/` (this folder) + ADR under `docs/` (folder `decisions/` is empty)
- `tools/backup-mariadb.sh` (or section in existing backup script)

**Modify**

- `config.ts`, `main.ts`, CLIs, `package.json` (`mysql2` dependency)
- SQLite stores (async + keep engine)
- Use cases that call stores (await)
- `resolve-upload-processing-config.ts` (do not require sqlite path)
- `.env copy.example`
- Tests currently calling stores synchronously
- `tools/backup-media-library.sh` after cutover
- Tests use `CreateUserUseCase` (done)

**Do not add** TagSpaces readers to MariaDB. Optionally later: stop shipping `import-library` as an operational tool (separate cleanup).

---

## 8. Data migration plan (not executed)

1. **Backup** SQLite file (`library.sqlite` + WAL/SHM if any) and a filesystem snapshot of videos/`.ts` as today. Keep that copy until MariaDB is validated.
2. **Create MariaDB schema** with the baseline migration on an **empty** database (local MariaDB first).
3. **Extract from SQLite** (read-only): `schema_migrations`, `tag_types`, `tags`, `videos`, `video_tags`, `users`.
4. **Sessions:** **inference / recommendation — skip**. Tokens are random and 30-day; forcing re-login is safer than copying session secrets to a new engine. **Needs confirmation** if you want zero logout.
5. **Preserve ids and `position`.** Insert in order: `tag_types` → `tags` → `videos` → `video_tags` → `users`. Disable FK checks only inside the importer transaction if needed, then re-enable and verify.
6. **Orphans:** rows in `video_tags` whose `video_id`/`tag_id` is missing; tags whose `tag_type_id` is missing; videos with duplicate `(video_id, position)`. **Do not silently drop without a report.** Count and pause on inconsistency.
7. **Verify:** counts of videos, tags, types, relations, users; spot-check `getVideoTags` order vs SQLite; login with a known user; search sample.
8. **Keep SQLite** as `DATABASE_ENGINE=sqlite` fallback until both Plesk and Windows have run against MariaDB successfully.
9. **Do not** re-run TagSpaces `import-library` as part of this move (would overwrite tags from stale sidecars).

**Needs confirmation:** path of production SQLite (`SQLITE_PATH` / `tools/backup-media-library.sh` uses `/mnt/storage/media-library/db/library.sqlite` — ops convention, not app code). Row counts are not in git.

---

## 9. Test strategy

**Reuse:** extract behaviour from `sqlite-library-store.test.ts` (CRUD, FK/unique, `setVideoTags` rollback, tag types, migrations **SQLite-only**) and `sqlite-auth-store.test.ts` / `auth.test.ts` into **contract tests** parameterized by a store factory.

**Add**

| Area | Approach |
|------|----------|
| Contract | Same assertions on SQLite `:memory:` and MariaDB (Testcontainers **or** `MARIADB_*` in CI/dev) |
| Transactions | Failed `setVideoTags` leaves previous relations |
| Relations + `position` | Order after set/add/remove |
| Auth | Hash verify, unique username, expiry, HTTP 401/403, `AUTH_PUBLIC_READ=false` |
| Queries | Tag usages, default type, `ON DUPLICATE` recorded_at coalesce |
| Errors / close | Pool `end()`; unique mapped without SQLite message regex |
| Backend | Existing HTTP tests with MariaDB factory |
| Two engines | `DATABASE_ENGINE` validation unit tests |

**SQLite-specific tests stay:** migration v2/v3 upgrades, `STRICT`, `PRAGMA`.  
**MariaDB-specific:** baseline apply idempotency, charset/collation, `insertId`.

Widen `backend` `test` script beyond `health` + `auth` so adapter contracts actually run.

**Cannot verify in this audit:** a live Plesk MariaDB or Windows tunnel.

---

## 10. Implementation milestones

### A — Code (local, no production DB)

| # | Goal | Files | Depends | Done when |
|---|------|-------|---------|-----------|
| **M0** | Optionally extract store contracts from SQLite tests | tests | — | Contract tests compile |
| **M1** | Async `LibraryStore` / `AuthStore`; SQLite still works | ports, sqlite adapters, use cases, tests | — | **Done.** Ports return `Promise`; SQLite remains the engine. |
| **M2** | `DATABASE_ENGINE` + config validation; `openStores()`; `UPLOAD_TEMP_PATH` independent | `config.ts`, `open-stores.ts`, `main.ts`, CLIs, env example | M1 | SQLite path unchanged when `engine=sqlite`; mariadb config rejected if incomplete |
| **M3** | MariaDB migrations + `mysql2` pool + both stores | `adapters/mariadb/*`, `package.json` | M2 | Contract tests pass against local MariaDB |
| **M4** | Importer CLI SQLite → MariaDB | `migrate-sqlite-to-mariadb.ts` | M3 | Dry-run on a **copy** of SQLite; counts match |
| **M5** | Docs ADR + env + backup notes (English) | `docs/`, tools scripts (docs only until cutover) | M3 | Reviewable ops runbook |

**Risks:** large await churn (M1); collation surprises (M3); N+1 performance (defer).

### B — Database (not production first)

| # | Goal | Done when |
|---|------|-----------|
| **D1** | Local MariaDB database + user, no remote bind | App connects on `127.0.0.1` |
| **D2** | Apply baseline schema | Empty schema matches contract tests |
| **D3** | Load copy of production SQLite via M4 | Verification queries match |

### C — Server configuration (Plesk)

| # | Goal | Done when |
|---|------|-----------|
| **S1** | Database + user in Plesk; listen **localhost only** | Confirmed bind address (**needs confirmation** on the server) |
| **S2** | App env on server: `DATABASE_ENGINE=mariadb`, `MARIADB_HOST=127.0.0.1`, secrets in Plesk/env, not git | Process starts |
| **S3** | SSH tunnel recipe for Windows (or VPN); MariaDB **not** opened to `0.0.0.0` | Local app uses `127.0.0.1` through tunnel |

### D — Data migration

| # | Goal | Done when |
|---|------|-----------|
| **X1** | Freeze writes (or short maintenance) | Agreed window |
| **X2** | SQLite file backup + dump empty MariaDB | Restore drill documented |
| **X3** | Run importer against production MariaDB | Counts + sample + login |
| **X4** | Keep SQLite file immutable as rollback | File not deleted |

### E — Deploy and recovery

| # | Goal | Done when |
|---|------|-----------|
| **P1** | Deploy build with engine switch; server `mariadb` | Health + login + search |
| **P2** | Windows `.env` same engine, host `127.0.0.1`, tunnel up | Same user/tags as server |
| **P3** | Update backup script to `mariadb-dump`; rsync media only | Restore tested once |
| **Rollback** | `DATABASE_ENGINE=sqlite` + original file; MariaDB unused | App serves previous metadata |

**Do not** migrate production until M3–M4 succeed locally on a copy.

---

## 11. Risks and pending decisions

| Item | Type | Notes |
|------|------|--------|
| Async ports | Fact + required decision | Confirm Promise on all store methods |
| `mysql2` vs official `mariadb` | Decision | Default proposal: `mysql2` |
| Collation / unique tag names | Needs confirmation | Inspect SQLite for case-only duplicates before choosing `utf8mb4_bin` |
| Migrate `sessions`? | Decision | Propose **no** |
| Two processes + `InMemoryVideoIndex` | Decided | Coarse timer reload from `LibraryStore` |
| `AUTH_PUBLIC_READ` | Decided | Deployed `false`; do not change policy during DB work |
| Plesk MariaDB bind / version | Needs confirmation | Affects `ON DUPLICATE` syntax and dump tools |
| User CLI | Decided | `create-user` only |
| `import-library` still reads TagSpaces | Fact | Must not run after MariaDB cutover; leftover, not target architecture |
| Thumbnail `.ts` layout | Fact | Out of MariaDB scope |
| Cookie `Secure` | Fact | Separate hardening |
| Processing jobs in memory | Fact | Unrelated; uploads stay node-local |
| Test script coverage | Fact | Most sqlite tests not in `pnpm test` |

---

## 12. Final recommendation

1. **Treat MariaDB as the only metadata source of truth**; keep SQLite as a **transitional engine flag**, not as a second live database.
2. **Do not change domain types**; **do** make persistence ports async.
3. **Implement `MariadbLibraryStore` + `MariadbAuthStore`** with `mysql2` pooling; compose in `main`/CLIs via `DATABASE_ENGINE`.
4. **Baseline MariaDB schema = current SQLite v4**, loaded by a one-shot copy of rows (ids + `position` + password hashes).
5. **Connect from Windows through SSH/VPN to localhost**; never publish MariaDB.
6. **Leave HTTP auth policy untouched** (`AUTH_PUBLIC_READ=false` in env); only swap `AuthStore`.
7. **Do not** put TagSpaces in the target architecture; leave leftover `.ts/` thumbnail paths and `import-library` as later cleanup, not MariaDB scope.
8. **Reload the in-memory index from the store on a coarse timer** when both server and PC run the API against the same DB.
9. **Keep `create-user` as the only user CLI.**
10. **Replace SQLite-file backup** with `mariadb-dump` after cutover; keep the old file until you have a successful restore drill.

### Proposal to review before any code change

Authorize, in order: **M1 (async ports, SQLite green) → M2 (engine config) → M3 (MariaDB adapters + contract tests on a local MariaDB)**. Pause for review before **M4 importer** and before **any Plesk/database/server change**.

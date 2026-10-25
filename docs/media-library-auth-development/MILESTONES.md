# Milestones — Auth & roles

Status: implemented.

Do this in **three slices**, not one shot. Backend enforcement must land
before the UI, so a disabled button is never the only protection. M1 is
schema-only and shippable; M2 already protects the API; M3 is the visible
login/logout behaviour.

**Current product (after these slices):** `AUTH_PUBLIC_READ=false` in the
environment, so catalog GET requires `view` or `admin`. The first UI screen
is an access-restricted notice until sign-in. Users are created with
`create-user` (`--role admin|view`). See `README.md` and `DECISIONS.md`.

## Decisions to lock

- Roles: `admin` | `view`. Only `admin` may write.
- Deployed read lock: `AUTH_PUBLIC_READ=false` (existing flag, not a new
  auth system). Anonymous **write** was already denied.
- View-user create/delete UI for admins (`docs/media-library-admin-users/`).
  Operators still use `create-user` for admin accounts.
- Session cookie + store `sessions`; scrypt hashes; `@fastify/cookie`.
- Logout in the header. Session ~30 days until logout or expiry.
- Mutating APIs (below) return 401 without a valid session and 403 if
  the session is not `admin`.
- `GET /api/health` stays unauthenticated (ping).

Mutating endpoints to protect:

- `POST /api/library/refresh`
- `POST /api/admin/uploads`
- `POST|PUT|DELETE /api/videos/:id/tags` (and tag delete)
- `DELETE /api/videos/:id` (delete video)
- `PUT|DELETE /api/admin/tags/:id`
- `POST|PUT|DELETE /api/admin/tag-types`

GET (including search, tags, stream, thumbnails, upload status) was
public in phase 1. Production now sets `AUTH_PUBLIC_READ=false`.

## Objective

Signed-in `view` or `admin` users can watch and browse. An admin session
enables editing. The server rejects forged write calls and anonymous
catalog reads when public-read is off.

Source media stays read-only except for explicit admin install/delete.
Tag metadata lives in the application database.

## M1 — Schema, hashing, session store, CLI

- SQLite v4: `users` (`id`, `username`, `password_hash`, `role`,
  `created_at`) and `sessions` (`token`, `user_id`, `created_at`,
  `expires_at`).
- Role check constraint: `admin` | `view`.
- Port + SQLite adapter for users/sessions.
- Hash/verify helpers (`scrypt`).
- CLI to insert users (`create-user`, optional `--role`). No row in the
  migration SQL.
- Unit tests for hash verify, unique username, session create/delete.

No HTTP auth yet. Existing app behaviour unchanged.

## M2 — Auth API and write guards

- `POST /api/auth/login` `{ username, password }` → set cookie, 401 on
  bad credentials.
- `POST /api/auth/logout` → clear cookie and session row.
- `GET /api/auth/me` → `{ authenticated, username, role }` (200 even
  when anonymous, with `authenticated: false`).
- Shared authorize helper: `canRead` / `canWrite` using
  `AUTH_PUBLIC_READ`.
- All mutating routes call `canWrite`; tests cover 401/403 and GET with
  public-read on or off.
- Document `AUTH_PUBLIC_READ`. Tests can force the flag in isolation.
  Deployed environments set it to `false`.

## M3 — Frontend: login, logout, disable writes

- Hold session from `GET /api/auth/me` (cookie sent with `fetch`
  credentials).
- Header: Log in (modal: username, password) when anonymous; username +
  Log out when admin.
- Disable confirm / submit on write modals and `Add type` when not
  admin.
- Skip video-tag `PUT` (and other client writes) when not admin.
- Disable upload submit and library refresh when not admin.
- Catalog UI is gated until a `view` or `admin` session exists
  (`AUTH_PUBLIC_READ=false`).
- Tests: anonymous cannot persist tags; admin login enables writes;
  logout disables them again; GET returns 401 when public-read is off.

### Completion

Writes are admin-only on API and UI. Catalog GET requires `view` or
`admin` when `AUTH_PUBLIC_READ=false`. Users are created with
`create-user`. Tests, typecheck, and build pass.

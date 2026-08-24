# Milestones — Auth & roles

Status: implemented.

Do this in **three slices**, not one shot. Backend enforcement must land
before the UI, so a disabled button is never the only protection. M1 is
schema-only and shippable; M2 already protects the API; M3 is the visible
login/logout behaviour.

## Decisions to lock

- Roles in SQLite: `admin` | `view`. Only `admin` is used for writes now.
- Phase 1: anonymous **read** is allowed. Anonymous **write** is denied.
- Future: `AUTH_PUBLIC_READ=false` can require at least `view` on GET.
  Login-first page and extra `view` users are then UI/data work, not a
  new auth model.
- No user CRUD UI. First admin inserted with the create-admin CLI.
- Session cookie + SQLite `sessions`; scrypt hashes; `@fastify/cookie`.
- Logout in the header. Session ~30 days until logout or expiry.
- Mutating APIs (below) return 401 without a valid session and 403 if
  the session is not `admin`.

Mutating endpoints to protect:

- `POST /api/library/refresh`
- `POST /api/admin/uploads`
- `POST|PUT|DELETE /api/videos/:id/tags` (and tag delete)
- `DELETE /api/videos/:id` (delete video)
- `PUT|DELETE /api/admin/tags/:id`
- `POST|PUT|DELETE /api/admin/tag-types`

GET (including search, tags, stream, thumbnails, upload status) stay
public in phase 1.

## Objective

Anonymous visitors can watch and browse. An admin session enables
editing. The server rejects forged write calls. The data model already
knows `view` users and a future read lock.

TagSpaces metadata and source media stay read-only.

## M1 — Schema, hashing, session store, CLI

- SQLite v4: `users` (`id`, `username`, `password_hash`, `role`,
  `created_at`) and `sessions` (`token`, `user_id`, `created_at`,
  `expires_at`).
- Role check constraint: `admin` | `view`.
- Port + SQLite adapter for users/sessions.
- Hash/verify helpers (`scrypt`).
- CLI to insert the first admin. No row in the migration SQL.
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
- All mutating routes call `canWrite`; tests cover 401/403 and that GET
  still works without a cookie while public-read is on.
- Document the env flag for turning public-read off later (test that
  GET then returns 401 without a session). That test can force the flag
  in isolation; production default stays public-read.

## M3 — Frontend: login, logout, disable writes

- Hold session from `GET /api/auth/me` (cookie sent with `fetch`
  credentials).
- Header: Log in (modal: username, password) when anonymous; username +
  Log out when admin.
- Disable confirm / submit on write modals and `Add type` when not
  admin.
- Skip video-tag `PUT` (and other client writes) when not admin.
- Disable upload submit and library refresh when not admin.
- Screens remain reachable without login.
- Tests: anonymous cannot persist tags; admin login enables writes;
  logout disables them again.

### Completion

Writes are admin-only on API and UI. Catalog works logged out. `view`
and `AUTH_PUBLIC_READ=false` are in the model and policy, unused as the
default product behaviour. Tests, typecheck, and build pass.

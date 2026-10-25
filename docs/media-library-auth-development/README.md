# Media Library — Auth & roles

Users must sign in to query the catalog. This is the existing auth model with
`AUTH_PUBLIC_READ=false` in the environment, not a separate authentication
system.

Canonical decisions: `DECISIONS.md`. Implementation history: `MILESTONES.md`.

Admins can create and delete **view** users and run a MariaDB → SQLite
backup from **Admin zone** (`/admin`).
Operators still create **admin** users with the backend CLI.

## Current behaviour

- `AUTH_PUBLIC_READ=false` in the deployed environment. GET/HEAD for library
  content require a session with role `view` or `admin`.
- Code still treats any value other than the string `false` as public-read
  (`backend/src/config.ts`). Leaving the variable unset would reopen anonymous
  GET; do not rely on the code default for production.
- Roles:
  - `view` — browse, watch, download, and cast (read). Casting is documented in `docs/media-library-cast/README.md`.
  - `admin` — read plus writes (tags, types, upload, refresh, delete).
- Session cookie (`media_library_session`), scrypt password hashes, SQLite
  `users` / `sessions` today (MariaDB later, same `AuthStore` port).
- CLI: `pnpm --filter @media-library/backend create-user -- --username NAME --password PASS [--role admin|view]`.
  Default role is `admin`.
- Frontend: `frontend/src/App.vue` shows an access-restricted first screen
  until `GET /api/auth/me` reports an authenticated `view` or `admin` user.
  Login remains in the header.

## Out of scope

- User create / invite / list UI
- OAuth, SSO, email, password reset
- Per-video permissions
- Replacing the current policy helpers (`canRead` / `canWrite`)

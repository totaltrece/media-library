# Decisions — Admin users

## Scope

Only **view** users are listed, created, or deleted in the UI. Creating an
admin remains `pnpm --filter @media-library/backend create-user`. There is
no edit/rename/password-reset screen.

## Authorization

POST/DELETE already need `admin` via `canWrite`. Listing users is a GET, so
`auth-policy` treats `/api/admin/users` and `/api/admin/backup` as admin-only
even for GET/HEAD. A `view` session receives 403. The frontend hides Admin
zone links and guards those routes; the API is the real control.

Backup reads MariaDB and writes a replacement SQLite file at `SQLITE_PATH`
(temp file, then rename). It includes password hashes so the file can restore
accounts. It skips sessions. The running process keeps using MariaDB.

## Ports

`AuthStore` gained `listUsers(role?)` and `deleteUser(id)`. Use cases:

- `ListViewUsersUseCase` — `listUsers("view")`
- `CreateUserUseCase` with `role: "view"` from the HTTP adapter
- `DeleteViewUserUseCase` — load, refuse non-view, then delete

SQLite (`node:sqlite`) and MariaDB (`mysql2`) implement the same methods.
Passwords stay scrypt hashes. Usernames stay unique.

## Frontend

`AppHeader` filters `adminOnly` items with `canWrite`. Vue Router
`meta.requiresAdmin` redirects to home after `loadAuthSession`. Admin
users and backup share `/admin`.

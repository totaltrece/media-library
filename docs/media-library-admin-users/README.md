# Admin users

Admins can create and delete **view** accounts from the web UI. Admin
accounts stay on `create-user`. This does not change roles, cookies, or
`AUTH_PUBLIC_READ`.

**Admin zone** (`/admin`) combines view-user management and the MariaDB →
SQLite backup. Old paths `/admin/users` and `/admin/backup` redirect there.

## Behaviour

- After a **view** login, the UI always opens the video list (`/`).
- Nav link **Admin zone** is shown only when `role === admin`.
- Route `/admin` redirects home unless the session is admin.
- HTTP: `GET/POST /api/admin/users`, `DELETE /api/admin/users/:id`.
- POST always stores `role: view`, even if the body includes another role.
- DELETE refuses admin rows (`CannotDeleteAdminUserError`).
- GET of `/api/admin/users` and `/api/admin/backup` requires admin.
- HTTP: `POST /api/admin/backup` dumps MariaDB (no sessions) into the SQLite
  file. Returns 409 when the live engine is SQLite or `SQLITE_PATH` is unset.
  Pulling the **server** SQLite onto this machine is `tools/backup-media-library.sh`,
  not this button.

## Persistence

`AuthStore.listUsers` and `AuthStore.deleteUser` are implemented in SQLite
and MariaDB. Sessions cascade when a user row is deleted. No schema
migration is required.

# Decisions — Auth & roles

## Approach

Do not add Passport, Auth0, or a JWT library. Auth stays a small hexagonal
slice: application use cases + an auth store port + HTTP cookie adapter.

## Passwords

Hash with Node `crypto.scrypt` (no new dependency). Never store plaintext.
Never commit a password or hash in git.

## Sessions

Opaque session token (32 random bytes, hex) stored in SQLite `sessions`.
Sent as an httpOnly `SameSite=Lax` cookie via `@fastify/cookie` (the only
new library). Logout deletes the row and clears the cookie.

Why not JWT: logout would need a denylist; a server session is the natural
fit for a single-node SQLite app.

Default lifetime: 30 days. Configurable later; not a blocker.

## Roles

`admin` — read + write.
`view` — read only (enforced on GET only after public-read is turned off).

Phase 1 write check: session exists and `role === 'admin'`.
A `view` session in phase 1 can read (like anonymous) but cannot write.

## Public read flag

Application policy, not scattered `if`s in every controller:

- `AUTH_PUBLIC_READ=true` (phase 1 default): GET/HEAD allowed without login.
- `AUTH_PUBLIC_READ=false` (future): GET/HEAD require a session with
  `view` or `admin`.

POST/PUT/DELETE always require `admin`, in both modes.

## First user

No web form. Schema migration creates empty `users` / `sessions`.
A CLI (`pnpm --filter @media-library/backend create-admin`) inserts the
first admin with a hashed password. Safe to refuse if that username exists.

## Frontend

Phase 1: login control in the header (modal or inline form). The catalog
loads without login. Future login-first page can reuse the same
`POST /api/auth/login` and `GET /api/auth/me`.

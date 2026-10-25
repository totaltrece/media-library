# Decisions — Auth & roles

## Approach

Do not add Passport, Auth0, or a JWT library. Auth stays a small hexagonal
slice: application use cases + an auth store port + HTTP cookie adapter.

## Passwords

Hash with Node `crypto.scrypt` (no new dependency). Never store plaintext.
Never commit a password or hash in git.

## Sessions

Opaque session token (32 random bytes, hex) stored in the auth store
(`sessions` table). Sent as an httpOnly `SameSite=Lax` cookie via
`@fastify/cookie`. Logout deletes the row and clears the cookie.

Why not JWT: logout would need a denylist; a server session is the natural
fit.

Default lifetime: 30 days. Configurable later; not a blocker.

## Roles

`admin` — read + write.
`view` — read only.

Write check: session exists and `role === 'admin'`. A `view` session can
browse and watch but cannot mutate.

## Public read flag

Application policy in `auth-policy.ts`, not scattered `if`s in every
controller:

- `AUTH_PUBLIC_READ=true`: GET/HEAD allowed without login.
- `AUTH_PUBLIC_READ=false` (**current deployed setting**): GET/HEAD require
  a session with `view` or `admin`.

POST/PUT/DELETE always require `admin`, in both modes.

The backend default if the variable is omitted is still public-read. Deployed
instances must set `AUTH_PUBLIC_READ=false`. That is configuration, not a new
auth stack.

## Users

Schema migration creates empty `users` / `sessions`. Admins manage **view**
users in the UI (`docs/media-library-admin-users/`). Admin accounts:

```text
pnpm --filter @media-library/backend create-user -- --username NAME --password PASS [--role admin|view]
```

```text
pnpm --filter @media-library/backend create-user -- --username NAME --password PASS [--role admin|view]
```

Default `--role` is `admin`. Safe to refuse if that username exists.

`GET /api/health` is an unauthenticated ping (GET/HEAD), including when
public-read is off.

## Frontend

Header: Log in (modal) when anonymous; username + Log out when signed in.
Writes stay disabled unless `admin`.

When the session cannot read (`canView` is false), the first screen is an
access-restricted notice (`frontend/src/App.vue`) instead of the catalog.
That matches `AUTH_PUBLIC_READ=false`.

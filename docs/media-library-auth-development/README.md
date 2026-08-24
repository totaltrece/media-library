# Media Library — Auth & roles

Simple login so catalog browsing stays public in phase 1, while writes
(tags, types, upload, refresh, delete) require an `admin` session.

Documents:
- `MILESTONES.md` — implementation slices
- `DECISIONS.md` — agreed technical choices

There is no user-management UI in this feature. The first admin row is
inserted into SQLite with a small CLI (correct password hash). TagSpaces
files and source media stay read-only.

## Goal (phase 1)

- One real user: `admin`, role `admin`.
- Username + password login; logout in the header.
- Anonymous visitors see the same screens as today.
- Confirmation buttons in modals are disabled when not logged in as admin.
- Video tag auto-save does not call `PUT` unless admin.
- `Add type` and other write controls are disabled unless admin.
- Every `POST` / `PUT` / `DELETE` under `/api` rejects unauthenticated or
  non-admin callers (401 / 403), not only the UI.

## Prepared for later (not enabled)

- Role `view` exists in the schema.
- Backend authorization is a single policy used by HTTP adapters:
  `canRead` and `canWrite`.
- Phase 1: `canRead` is true without a session (`public-read`).
- Later: set public-read off so GETs require at least `view`, optional
  login-first page, and extra `view` users. No GET lock and no login wall
  in phase 1.

## Out of scope (phase 1)

- User create / invite / list UI
- Login as the first page of the app
- Blocking GET / search / stream / thumbnails for anonymous users
- OAuth, SSO, email, password reset
- Per-video permissions

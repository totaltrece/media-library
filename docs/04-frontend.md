# Frontend

Version: 2.1

---

# Purpose

The frontend is the primary user interface of Media Library.

Its responsibility is to allow users to browse, search and watch videos from
their TagSpaces library using a standard web browser.

The frontend contains no business logic.

All media information is obtained through the backend API.

---

# Design Principles

The frontend should be:

- responsive
- lightweight
- fast
- mobile-first
- framework-independent where practical

Business rules belong in the backend.

The frontend focuses exclusively on user interaction and presentation.

---

# Main Responsibilities

The frontend is responsible for:

- searching videos
- displaying search results
- displaying thumbnails
- selecting videos
- playing streamed videos
- refreshing the indexed library
- handling loading and error states

The frontend never accesses the filesystem.

---

# Main Screens

## Search

The initial screen contains:

- compact tag search box with selected tags inside the field
- results update as soon as a tag is added or removed
- shared header: View, Upload video, Admin videos, Admin tags, and refresh library
- search results

Searching should feel immediate and responsive.

---

## Results

Each result displays:

- thumbnail
- tags

The MVP does not display filenames. Selecting a result opens the embedded player.

---

## Video Player

The player streams the selected video directly from the backend.

Playback uses the standard HTML5 `<video>` element.

The player supports:

- play
- pause
- seek
- fullscreen

The frontend never downloads or copies media files.

---

## Admin video tags

Additional screens live at `/admin/videos`, `/admin/videos/upload`, `/admin/videos/:id`, and `/admin/tags`.

They reuse the existing `TagSearch` component and `GET /api/search?tag=...`
to find videos by tags, filter untagged items, and edit tags through
`GET /api/videos/:id/tags`, `GET /api/tags`, and `PUT /api/videos/:id/tags`.
The edit screen can also delete the video with `DELETE /api/videos/:id` after
a confirmation modal. A successful delete returns to `/admin/videos`, which
reloads the catalog from `GET /api/search` and `GET /api/tags`.

`/admin/videos` shares the same header as `/`, `/admin/videos/upload`, and
`/admin/tags`: **View**, **Upload video**, **Admin videos**, **Admin tags**,
and refresh library (`POST /api/library/refresh`). The current section is
highlighted. Upload lives at `/admin/videos/upload`: it loads
`GET /api/admin/uploads/active` on enter. If a job is `uploading` or
`processing`, it shows the progress zone and polls
`GET /api/admin/uploads/:jobId`. Otherwise it shows the upload picker.
`POST /api/admin/uploads` uses multipart field `video`. During HEVC
conversion the processing step shows `progress` (0–100). `/admin/videos` and
the consumer screen at `/` do not include this upload zone. After a
successful upload, **View in Untagged** returns to the catalog with the new
video visible through `GET /api/search`; the upload page does not call
`POST /api/library/refresh`.

The tag catalog at `/admin/tags` is managed through `GET /api/admin/tags`,
`PUT /api/admin/tags/:id`, and `DELETE /api/admin/tags/:id`.
The consumer search screen at `/` is unchanged.

# Layout

The application follows a simple two-area layout.

Desktop:

```text
+-------------------------------+
| Search                        |
+-------------------------------+
| Results       | Video Player  |
|               |               |
|               |               |
+---------------+---------------+
```

Tablet / Mobile:

```text
Search

↓

Results

↓

Video Player
```

The interface should remain comfortable on portrait-oriented devices.

---

# Communication

The frontend communicates exclusively with the REST API under `/api`.

In production and local end-to-end testing, the Vue application is served by
Fastify from `/` on the same port as the API.

Typical flow:

```text
User searches

↓

GET /api/search

↓

Display results

↓

User selects a video

↓

GET /api/video/:id

↓

HTML5 video playback
```

During frontend development, Vite can still run separately and proxy `/api`
requests to the backend.

The frontend uses relative `/api/...` URLs. It never reads `LIBRARY_PATH` or
constructs filesystem paths.

No direct filesystem access exists.

---

# Components

The MVP should contain a small number of reusable components.

Suggested components:

- SearchBar
- SearchResults
- SearchResultItem
- VideoPlayer
- LoadingIndicator
- ErrorMessage

Additional components can be introduced only when they simplify the codebase.

---

# State Management

The MVP should keep state management simple.

Typical application state:

- current query
- search results
- selected video
- loading state
- error state

Global state libraries are unnecessary unless future complexity justifies them.

---

# Responsive Behaviour

The application is designed primarily for tablets.

Portrait orientation should provide the best experience.

Fullscreen playback must work correctly for vertically recorded videos.

Desktop browsers should also provide a comfortable experience.

---

# Responsibilities Summary

Frontend

- user interaction
- presentation
- navigation
- video playback

Backend

- indexing
- searching
- streaming
- filesystem access

---

# Deployment Build

The production build output in `frontend/dist` is versioned in Git.

When changing frontend source files:

1. Run `pnpm --filter frontend build`.
2. Commit the updated `frontend/dist` files together with the source changes.

A remote server can pull the committed `frontend/dist` and serve it through
Fastify without building the frontend locally. The backend serves `index.html`
at `/` and hashed files from `/assets/*` directly from that directory.
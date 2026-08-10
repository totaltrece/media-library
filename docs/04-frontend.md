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

- search box
- active tag filters
- search button (optional)
- refresh library button
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
Fastify without building the frontend locally.
# Milestones

Version: 2.0

---

# Philosophy

Media Library is developed through small, independent milestones.

Each milestone should:

- produce working software
- be fully testable
- preserve the read-only philosophy
- avoid unnecessary refactoring
- leave the project in a releasable state

Every milestone should end with all tests passing.

---

# Milestone 1 — Project Foundation

Status: ✅ Completed

Objectives

- Create the monorepo
- Configure pnpm workspace
- Configure Turborepo
- Configure TypeScript
- Establish project structure

Deliverable

A clean, buildable workspace.

---

# Milestone 2 — Library Indexer

Status: ✅ Completed

Objectives

- Discover videos recursively
- Locate TagSpaces metadata
- Locate thumbnails
- Extract tag titles
- Handle missing or invalid metadata

Deliverable

A complete in-memory representation of the media library.

---

# Milestone 3 — Search Engine

Status: ✅ Completed

Objectives

- Search by tags
- Multiple tag matching
- Case-insensitive matching
- Preserve search order

Deliverable

A reusable search package independent of any transport.

---

# Milestone 4 — Command Line Tool

Status: ✅ Completed

Objectives

- Index a library
- Execute searches
- Display matching videos

Deliverable

A working CLI capable of searching a real TagSpaces library.

---

# Milestone 5 — Backend API

Status: ✅ Completed

Objectives

- Fastify server
- Dependency wiring
- Health endpoint
- Search endpoint
- JSON responses

Deliverable

A REST API exposing search functionality.

---

# Milestone 6 — Search Response Redesign

Status: ✅ Completed

Objectives

- Introduce a stable media identifier
- Return the executed query
- Include media name
- Return future thumbnail URL
- Return future video URL
- Keep filesystem paths hidden

Deliverable

A stable API contract that the frontend can consume without modification as new endpoints are added.

---

# Milestone 7 — Thumbnail API

Status: ✅ Completed

Objectives

- Resolve media identifiers
- Serve existing TagSpaces thumbnails
- Return correct content types
- Handle missing thumbnails gracefully

Deliverable

A `/thumbnail/:id` endpoint.

---

# Milestone 8 — Video Streaming

Status: ✅ Completed

Objectives

- Stream original videos
- Support HTTP Range requests
- Avoid temporary copies
- Preserve read-only behaviour

Deliverable

A `/video/:id` endpoint compatible with HTML5 video players.

---

# Milestone 8.5 — Tags API

Status: ✅ Completed

Objectives

- Expose all distinct indexed tags through the REST API
- Reuse the in-memory video index built at startup
- Return tags in deterministic alphabetical order
- Keep the endpoint read-only

Deliverable

A `/tags` endpoint that returns `{ count, tags }` for frontend tag selection and autocomplete.

---

# Milestone 9 — Vue Frontend

Status: ✅ Completed

Objectives

- Vue application
- API client
- Search interface
- Search results
- Thumbnail display
- Responsive layout

Deliverable

A browser-based interface capable of searching and browsing the media library.

The MVP frontend also includes basic HTML5 video playback using the existing
streaming endpoint.

---

# Milestone 10 — Unified Application Server

Status: ✅ Completed

Objectives

- Serve the built Vue frontend from Fastify at `/`
- Expose all API endpoints under `/api`
- Use relative `/api/...` URLs in the frontend
- Keep Vite for building the frontend
- Preserve tag search, thumbnails, and video streaming

Deliverable

A single-port application where Fastify serves both the web UI and the REST API.

---

# Milestone 11 — Library Refresh

Status: ✅ Completed

Objectives

- Re-index the library without restarting the server
- Expose `POST /api/library/refresh`
- Replace the in-memory video index safely
- Add a frontend refresh control with loading and error states

Deliverable

Users can pick up newly added videos and updated TagSpaces metadata while the
application keeps running.

---

# Milestone 12 — Video Player

Status: ⏳ Planned

Objectives

- Refine portrait-first playback
- Improve fullscreen experience
- Enhance tablet-specific player interactions

Deliverable

A polished end-to-end workflow from search to video playback.

---

# Milestone 13 — Library Statistics

Status: ⏳ Planned

Objectives

- Number of indexed videos
- Number of unique tags
- Library location
- Last indexing time

Deliverable

A `/stats` endpoint.

---

# Milestone 14 — Tag types

Status: implemented

Typed tags with colors, sort-by-type in tag admin, a tag-type configuration
screen, and a modal to edit tag name and type. Detail in
`docs/media-library-tag-types-development/`.

Deliverable

Colored chips in the catalog and tag admin; CRUD for types; new tags default
to resource.

---

# Milestone 15 — MVP Completion

Status: ⏳ Planned

Objectives

- Improve error handling
- Improve loading states
- Verify responsiveness
- Verify streaming performance
- Prepare production build

Deliverable

A stable application suitable for everyday personal use.

---

# MVP Definition

The MVP is complete when a user can:

1. Open Media Library from another device.
2. Search videos using TagSpaces tags.
3. Browse matching results with thumbnails.
4. Select a video.
5. Watch it immediately through streaming.
6. Never access the original filesystem directly.

---

# Current Progress

```text
Foundation             ██████████ 100%

Indexer                ██████████ 100%

Search                 ██████████ 100%

CLI                    ██████████ 100%

Backend API            ██████████ 100%

Search Response        ██████████ 100%

Thumbnail API          ██████████ 100%

Video Streaming        ██████████ 100%

Tags API               ██████████ 100%

Vue Frontend           ██████████ 100%

Unified Server         ██████████ 100%

Library Refresh        ██████████ 100%

Video Player           ░░░░░░░░░░   0%

Library Statistics     ░░░░░░░░░░   0%

Production             ░░░░░░░░░░   0%
```

---

# Development Rule

Work on one milestone at a time.

A milestone is considered complete only when:

- implementation is finished
- tests pass
- documentation is updated
- the application remains functional
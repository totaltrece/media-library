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

# Milestone 9 — Vue Frontend

Status: ⏳ Planned

Objectives

- Vue application
- API client
- Search interface
- Search results
- Thumbnail display
- Responsive layout

Deliverable

A browser-based interface capable of searching and browsing the media library.

---

# Milestone 10 — Video Player

Status: ⏳ Planned

Objectives

- Play streamed videos
- Portrait-first layout
- Fullscreen playback
- Tablet-friendly interface

Deliverable

A complete end-to-end workflow from search to video playback.

---

# Milestone 11 — Library Statistics

Status: ⏳ Planned

Objectives

- Number of indexed videos
- Number of unique tags
- Library location
- Last indexing time

Deliverable

A `/stats` endpoint.

---

# Milestone 12 — MVP Completion

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

Vue Frontend           ░░░░░░░░░░   0%

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
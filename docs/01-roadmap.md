# Roadmap

Version: 2.0

---

# Vision

Media Library evolves in small, independently usable increments.

Each stage must produce a working application that users can immediately benefit
from.

The project grows by expanding capabilities rather than replacing previous
implementations.

---

# Stage 1 — Foundation

Goal

Build the technical foundations of the project.

Completed

- Monorepo
- Turborepo workspace
- TypeScript packages
- Hexagonal architecture
- Automated tests

Result

A maintainable project structure ready for development.

---

# Stage 2 — Library Discovery

Goal

Understand the TagSpaces library.

Completed

- Recursive video discovery
- TagSpaces metadata parsing
- Thumbnail discovery
- Tag extraction

Result

The application can understand an existing TagSpaces library without modifying
it.

---

# Stage 3 — Search Engine

Goal

Search indexed videos efficiently.

Completed

- Tag search
- Multiple tag search
- Case-insensitive search
- CLI search tool

Result

Videos can be searched from the command line.

---

# Stage 4 — HTTP Backend

Goal

Expose Media Library through a REST API.

Current status

In progress.

Capabilities

- Health endpoint
- Search endpoint
- Statistics endpoint
- Reindex endpoint

Result

Any client can communicate with the application through HTTP.

---

# Stage 5 — Media Streaming

Goal

Serve media files over HTTP.

Capabilities

- Video streaming
- Thumbnail streaming
- HTTP Range support
- Read-only access

Result

Clients can browse and watch videos without direct filesystem access.

---

# Stage 6 — Web Interface

Goal

Replace the command line with a browser interface.

Capabilities

- Search page
- Results list
- Embedded video player
- Responsive layout
- Fullscreen playback

Result

Users can browse and watch videos from any modern browser.

---

# Stage 7 — Daily Usage

Goal

Turn the application into a practical everyday tool.

Capabilities

- Fast startup
- Stable indexing
- Smooth playback
- Clear error reporting
- Production build

Result

Media Library becomes the primary way of consuming a personal TagSpaces video
library.

---

# Guiding Principles

Throughout every stage the project must remain:

- read-only
- self-hosted
- simple
- testable
- maintainable
- incremental

No stage should require rewriting previous work.

Each stage builds upon the previous one.
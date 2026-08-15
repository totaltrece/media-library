# Backend Architecture

Version: 2.0

---

# Purpose

The backend is responsible for exposing the media library through an HTTP API.

It coordinates indexing, searching and tag editing while keeping the domain
independent from infrastructure and frameworks.

The backend must never modify the original media library or any TagSpaces
metadata. Tag edits are persisted only in SQLite.

---

# Responsibilities

The backend is responsible for:

- serving the HTTP API
- coordinating indexing
- executing searches
- editing video tags in SQLite
- managing the SQLite tag catalog (rename and delete)
- exposing application statistics
- managing the application lifecycle
- receiving admin video uploads and running processing jobs in a temp workspace

The backend is not responsible for:

- rendering the user interface
- modifying media files
- writing TagSpaces metadata
- implementing business logic inside HTTP handlers

---

# Architectural Style

The backend follows Hexagonal Architecture.

Dependencies always point inward.

```text
                 HTTP
                  │
          Fastify Adapter
                  │
        Application Services
                  │
         Ports and Interfaces
                  │
              Domain Model
                  │
    -------------------------------
          Infrastructure
```

Frameworks are implementation details.

Business rules must never depend on Fastify or any other framework.

---

# Layers

## Domain

Contains business concepts.

Examples:

- IndexedVideo
- SearchQuery
- SearchResult

The domain contains no filesystem code, HTTP code or framework-specific types.

---

## Application

Contains use cases.

Examples:

- IndexLibrary
- SearchVideos
- GetStatistics
- ReindexLibrary

Each use case coordinates one task.

Application services communicate only through ports.

---

## Ports

Ports describe capabilities required by the application.

Examples:

- LibraryIndexer
- VideoSearcher
- StatisticsProvider

Ports are interfaces.

They contain no implementation.

---

## Adapters

Adapters implement ports.

Examples:

- TagSpaces filesystem reader
- Search adapter
- HTTP controllers
- FFmpeg video processor
- Filesystem processing workspace
- Multipart upload (`@fastify/multipart`)
- Future persistence adapters

Adapters may depend on external libraries.

The application layer never depends on adapters.

---

# Composition Root

The backend application is the only place where concrete implementations are
wired together.

Example:

```text
Fastify
        │
SearchController
        │
SearchVideosUseCase
        │
SearchRepository
```

Dependency creation should never leak into the domain.

---

# Request Flow

A typical request follows this sequence.

```text
HTTP Request
      │
Fastify Route
      │
Controller
      │
Application Use Case
      │
Port
      │
Adapter
      │
Response
```

Every layer has a single responsibility.

---

# Existing Packages

The backend reuses workspace packages.

Current packages:

- packages/indexer
- packages/search

Future packages should be added only when they represent a clear architectural
boundary.

---

# Error Handling

Expected errors should be translated into meaningful HTTP responses.

Unexpected errors should:

- be logged
- never expose internal details
- never crash the application unnecessarily

The backend should fail gracefully whenever possible.

---

# Configuration

Runtime configuration should be externalized.

Examples:

- library location (`LIBRARY_PATH`)
- server port (`PORT`)
- SQLite database path (`SQLITE_PATH`, required at runtime and for `pnpm import-library`)
- FFmpeg/FFprobe executables (`FFMPEG_PATH`, `FFPROBE_PATH`; optional, default to PATH names)
- upload temp directory (`UPLOAD_TEMP_PATH`; optional, defaults next to the SQLite file)
- upload size limit (`UPLOAD_MAX_BYTES`; optional, default 512 MiB)

Configuration should never be hardcoded.

---

# Testing Strategy

The backend should be tested at three levels.

## Unit Tests

Business rules.

No filesystem.

No HTTP.

Fast execution.

---

## Integration Tests

Filesystem adapters.

HTTP routes.

Package integration.

---

## End-to-End Tests

Complete API behaviour.

Real HTTP requests.

Temporary sample libraries.

---

# Design Principles

The backend should remain:

- read-only
- deterministic
- modular
- testable
- framework-independent

When in doubt, prefer the simplest solution that preserves these principles.

---

# Cursor Notes

Before implementing backend changes:

- Read AGENTS.md.
- Read docs/00-vision.md.
- Preserve the dependency direction.
- Keep Fastify outside the domain.
- Prefer extending existing packages.
- Add tests before completing the task.
- Keep commits focused and small.
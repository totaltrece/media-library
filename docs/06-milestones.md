# Development Milestones

Version: 1.0

---

# Purpose

This document defines the implementation milestones for Media Library.

Each milestone must:

- produce a working application
- be independently testable
- preserve the project architecture
- finish with a working commit

No milestone should require unfinished work from a future milestone.

---

# Current Status

Completed

- [x] Monorepo
- [x] Workspace configuration
- [x] Hexagonal architecture
- [x] Indexer package
- [x] Search package
- [x] CLI search tool
- [x] Automated tests

Current command:

```bash
pnpm run search -- --library "D:\Library" salsa bea
```

---

# Milestone 1

## Fastify Backend

Goal

Create the backend application.

Tasks

- [ ] Create Fastify server
- [ ] Add health endpoint
- [ ] Configure application startup
- [ ] Add backend tests

Result

Running

```text
GET /health
```

returns

```json
{
  "status": "ok"
}
```

---

# Milestone 2

## Search API

Goal

Expose the existing search package.

Tasks

- [ ] Create Search Controller
- [ ] Parse query parameters
- [ ] Call Search package
- [ ] Return JSON response
- [ ] Add integration tests

Result

```text
GET /search?tags=salsa,bea
```

returns matching videos.

---

# Milestone 3

## Library Statistics

Goal

Expose library statistics.

Tasks

- [ ] Statistics service
- [ ] Stats endpoint
- [ ] Tests

Result

```text
GET /stats
```

returns application statistics.

---

# Milestone 4

## Reindex API

Goal

Allow rebuilding the search index.

Tasks

- [ ] Reindex endpoint
- [ ] Replace active index
- [ ] Preserve previous index on failure
- [ ] Tests

Result

```text
POST /reindex
```

rebuilds the index.

---

# Milestone 5

## Vue Application

Goal

Create the frontend.

Tasks

- [ ] Create Vue application
- [ ] Connect to backend
- [ ] Basic layout

Result

Opening

```
http://localhost:5173
```

shows the application.

---

# Milestone 6

## Search Interface

Goal

Replace the CLI.

Tasks

- [ ] Search bar
- [ ] Search button
- [ ] Results list
- [ ] Loading indicator
- [ ] Empty state

Result

Users can search from the browser.

---

# Milestone 7

## Result Cards

Goal

Improve browsing.

Tasks

- [ ] Thumbnail
- [ ] Filename
- [ ] Tags
- [ ] Better layout

Result

Search results become easy to browse.

---

# Milestone 8

## Open Video

Goal

Open the selected video.

Tasks

- [ ] Backend endpoint
- [ ] Frontend action
- [ ] Error handling

Result

Selecting a result opens the corresponding video.

---

# Milestone 9

## Production Build

Goal

Prepare the application for daily use.

Tasks

- [ ] Production configuration
- [ ] Build scripts
- [ ] Documentation review
- [ ] Manual testing

Result

Media Library can be used as a normal desktop application.

---

# Definition of Done

A milestone is complete when:

- all tasks are finished
- tests pass
- documentation is updated
- the application works end-to-end
- the commit is small and reviewable

---

# Rules

Do not start the next milestone until the current one is complete.

Avoid implementing future milestones in advance.

Keep every milestone independently executable.
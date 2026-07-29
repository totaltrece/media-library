# Media Library Roadmap

Version: 1.0

---

# Goal

This roadmap describes the planned evolution of Media Library from the current
command-line prototype to a complete web application.

Every milestone must end with a working application that can be executed and
tested.

Architecture improvements are welcome only when they directly support the
current milestone.

---

# Current Status

The project already provides:

- Monorepo using pnpm and Turborepo.
- Hexagonal architecture.
- Indexer package.
- Search package.
- Command-line search tool.
- Automated tests.

Example:

```bash
pnpm run search -- --library "D:\Library" salsa bea
```

The CLI indexes the library and returns matching videos.

---

# Milestone 1 — Backend API

Goal

Expose the existing search engine through a REST API.

Result

The following request should work:

```text
GET /search?tags=salsa,bea
```

and return JSON results.

The existing packages must be reused.

No frontend yet.

---

# Milestone 2 — Web Interface

Goal

Replace the command line with a browser.

Result

A user can:

- open the application
- search by tags
- see matching videos

The frontend communicates only with the backend API.

---

# Milestone 3 — Video Browser

Goal

Turn search results into a pleasant browsing experience.

Result

Each result displays:

- thumbnail
- filename
- tags

The user can sort and browse results comfortably.

---

# Milestone 4 — Open Videos

Goal

Open videos directly from the browser.

Result

Selecting a result opens the corresponding video using the operating system.

No video streaming is required.

---

# Milestone 5 — Persistent Index

Goal

Avoid rebuilding the index every time the backend starts.

Result

The application stores an internal index that can be reused across executions.

The original media library remains untouched.

---

# Milestone 6 — Reindexing

Goal

Allow the user to refresh the index after modifying the TagSpaces library.

Result

The application provides an explicit reindex operation.

Automatic filesystem monitoring is not required.

---

# Milestone 7 — Statistics

Goal

Provide useful information about the library.

Examples

- total videos
- total tags
- most used tags

---

# Milestone 8 — Remote Access

Goal

Allow Media Library to run as a permanent server.

Result

The same library can be accessed from:

- desktop
- tablet
- mobile phone

through a web browser.

---

# Version 1.0

Media Library is considered version 1.0 when:

- indexing is reliable
- searching is fast
- the web interface is complete
- the application is stable
- the original TagSpaces library is never modified

---

# Development Rules

Every milestone must:

- produce a working application
- include automated tests
- preserve the read-only guarantee
- keep the hexagonal architecture
- avoid unnecessary dependencies
- finish with a small, reviewable commit
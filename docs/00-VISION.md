# Media Library Vision

Version: 1.0

---

# Purpose

Media Library is a read-only web application for browsing, searching and exploring
a personal multimedia library managed with TagSpaces.

The project reuses the metadata already maintained by TagSpaces and makes the
same library available through a web interface that can be accessed from any
device.

Media Library never replaces TagSpaces. TagSpaces remains responsible for
organizing and tagging the collection, while Media Library focuses on consuming
that information in a fast and convenient way.

---

# The Problem

The media library is already organized and tagged with TagSpaces.

The challenge is not managing or editing the collection, but accessing it
comfortably from devices where TagSpaces is not available or is not the preferred
way to consume the library.

Typical scenarios include:

- browsing the library from a tablet
- searching videos from a mobile phone
- accessing the collection through a web browser
- consuming the same tagged library from multiple devices
- keeping a single source of truth without duplicating metadata

Media Library is intended to expose an existing TagSpaces library through a
lightweight web application while fully preserving TagSpaces as the metadata
management tool.

---

# Target Users

The first target user is the repository owner.

The application is intentionally designed around a real personal library
containing dance videos tagged with TagSpaces.

Typical tags include:

- dance styles
- teachers
- events
- figures
- years
- difficulty
- quality notes
- custom personal tags

Although the first use case is dance videos, the architecture should remain
generic enough to support any TagSpaces-based media collection.

---

# Product Principles

The following principles should never be compromised.

## Read-only

Media Library never writes, renames, deletes or modifies:

- videos
- images
- TagSpaces metadata
- thumbnails

The original library is the source of truth.

---

## Fast Search

Searching should feel instantaneous regardless of the library size.

The implementation may evolve over time, but the user experience must always
prioritize responsiveness.

---

## Simplicity

The project prefers simple solutions over sophisticated ones.

Avoid introducing technologies before they solve a real problem.

Examples:

- no database in the MVP
- no authentication
- no cloud synchronization
- no background workers
- no microservices

---

## Clean Architecture

Business logic must remain independent from:

- HTTP
- Fastify
- Vue
- filesystem
- databases
- operating system

Hexagonal Architecture is used to keep the domain independent from infrastructure.

---

## Incremental Development

Every milestone should produce something usable.

Avoid long periods spent preparing infrastructure without delivering visible
features.

The application should evolve through small working increments.

---

# MVP

Version 0.1 allows a user to:

1. Open the web application.
2. Search videos using one or more tags.
3. Browse the matching results.
4. View video thumbnails.
5. Open the selected video using the operating system.

The application is intended for personal use and a single media library.

---

# Non Goals

The following features are explicitly outside the scope of version 0.1:

- editing tags
- editing metadata
- uploading videos
- deleting videos
- authentication
- user management
- cloud storage
- AI tagging
- video transcoding
- streaming server
- mobile applications

These features may be considered in future versions.

---

# Long-Term Vision

Future versions may include:

- persistent indexing
- advanced filtering
- full-text search
- fuzzy search
- saved searches
- statistics
- duplicate detection
- multiple libraries
- remote access
- AI-assisted search

These features should always preserve the read-only guarantee.

---

# Success Criteria

The project will be considered successful when the same TagSpaces library can be
comfortably explored from any web browser without modifying the original media or
its metadata.

TagSpaces remains the tool used to organize the collection, while Media Library
becomes the preferred way to consume it from other devices.

---

# Cursor Notes

Before implementing new features:

- Read AGENTS.md.
- Read this document.
- Preserve the read-only guarantee.
- Keep the hexagonal architecture.
- Prefer incremental improvements.
- Reuse existing packages whenever possible.
- Add tests for every new behaviour.
- Avoid introducing new dependencies unless they are clearly justified.
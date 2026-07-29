# Development Rules

Version: 2.0

---

# Purpose

This document defines the rules that every AI coding agent must follow when
working on Media Library.

The objective is to preserve the architecture, keep the project simple and avoid
unnecessary complexity while developing the MVP.

These rules apply regardless of whether the agent is Cursor, Codex, ChatGPT or
any future coding assistant.

---

# Current Project Status

The following milestones are already completed:

- pnpm workspace
- Turborepo
- TypeScript configuration
- Hexagonal architecture
- Indexer package
- Search package
- Command line search tool
- Fastify backend
- REST search endpoint

Development must continue from the current repository state.

Never recreate functionality that already exists.

---

# General Principles

Always prefer:

- small commits
- incremental development
- simple solutions
- readable code
- explicit code

Avoid unnecessary abstraction.

Do not introduce infrastructure for future requirements.

---

# Architecture

Respect the existing hexagonal architecture.

Dependency direction must always remain:

```text
Domain

↓

Application

↓

Ports

↓

Adapters

↓

Composition Root
```

Business logic must never depend on HTTP, Fastify, Vue, filesystem APIs or
framework-specific types.

---

# Read-only Guarantee

The application must never modify:

- video files
- TagSpaces metadata
- TagSpaces thumbnails
- directory structure

All media is treated as immutable.

---

# Frontend Rules

The frontend communicates only with the REST API.

It must never:

- access filesystem paths
- construct local paths
- assume media locations

All media must be identified using backend-generated identifiers.

---

# Backend Rules

The backend owns:

- indexing
- searching
- streaming
- filesystem access

Clients never receive physical filesystem paths.

---

# Streaming Rules

Videos are streamed directly from the original library.

Do not:

- duplicate media
- create temporary copies
- cache video files

Support efficient streaming using standard HTTP mechanisms.

---

# Implementation Rules

Implement only the requested milestone.

Do not implement future milestones unless explicitly requested.

Avoid speculative abstractions.

The simplest correct implementation is preferred.

---

# Dependencies

Do not introduce new dependencies unless they provide clear value.

Prefer the standard library whenever practical.

---

# Testing

Every behaviour change should include appropriate tests.

Tests should verify behaviour rather than implementation details.

Keep tests deterministic.

---

# Commits

Prefer small commits.

Each completed milestone should normally produce one coherent commit.

Avoid mixing unrelated changes.

---

# Before Finishing

Before considering a task complete:

- build succeeds
- tests pass
- documentation is updated if required
- architecture remains intact
- read-only guarantee is preserved

---

# When in Doubt

When requirements are unclear:

- make the smallest reasonable assumption
- explain the assumption
- avoid broad refactors
- ask only if the ambiguity blocks implementation
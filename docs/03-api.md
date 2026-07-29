# Frontend Architecture

Version: 1.0

---

# Purpose

The frontend provides a simple and responsive web interface for exploring a
TagSpaces media library.

Its only responsibility is presenting information returned by the backend.

All business logic remains on the server.

---

# Responsibilities

The frontend is responsible for:

- allowing users to search videos
- displaying search results
- displaying thumbnails
- opening selected videos
- showing application status

The frontend is not responsible for:

- indexing the library
- searching directly in the filesystem
- reading TagSpaces metadata
- implementing business rules

---

# Technology

The frontend is implemented using:

- Vue 3
- TypeScript
- Vite

The application is a Single Page Application (SPA).

---

# Communication

The frontend communicates only with the backend REST API.

It never accesses the filesystem directly.

All application data comes from HTTP requests.

---

# Application Layout

Version 1.0 consists of a single page.

```text
+--------------------------------------------------+

                Search Bar

----------------------------------------------------

             Search Results

----------------------------------------------------

             Status Bar

+--------------------------------------------------+
```

---

# Main Components

## App

Application root.

Responsible for application initialization.

---

## SearchBar

Allows entering one or more tags.

Responsibilities:

- edit search query
- submit search
- clear search

---

## SearchResults

Displays matching videos.

Responsibilities:

- render result list
- handle empty searches
- handle no results

---

## SearchResultCard

Displays one video.

Shows:

- thumbnail
- filename
- tags

Provides:

- open video

---

## StatusBar

Displays application information.

Examples:

- indexed videos
- search duration
- backend status

---

# User Flow

```text
Application Starts

↓

Load statistics

↓

User types tags

↓

Search request

↓

Results displayed

↓

User opens video
```

---

# State Management

Version 1.0 keeps state simple.

Application state includes:

- current query
- search results
- loading state
- backend status
- statistics

A dedicated state management library is not required.

Vue's built-in reactivity is sufficient.

---

# Routing

Version 1.0 uses a single route.

```
/
```

Additional routes may be introduced in future versions.

---

# Error Handling

The frontend should gracefully handle:

- backend unavailable
- empty searches
- no results
- unexpected errors

Users should always receive a clear message.

---

# Styling

Version 1.0 prioritizes usability over visual design.

Goals:

- responsive layout
- desktop friendly
- tablet friendly
- mobile friendly

Avoid unnecessary visual complexity.

---

# Accessibility

The interface should:

- support keyboard navigation
- provide meaningful labels
- maintain sufficient contrast
- remain usable without a mouse

---

# Performance

The frontend should:

- avoid unnecessary renders
- minimize API requests
- remain responsive with large result sets

Premature optimization should be avoided.

---

# Testing Strategy

Frontend tests should cover:

- components
- API integration
- user interaction

Visual appearance should not be tested unless behaviour depends on it.

---

# Design Principles

The frontend should remain:

- simple
- responsive
- predictable
- framework-idiomatic
- independent from backend implementation details

---

# Cursor Notes

Before implementing frontend changes:

- Read AGENTS.md.
- Read docs/00-vision.md.
- Read docs/03-api.md.
- Keep business logic on the backend.
- Do not duplicate server-side logic.
- Add component tests whenever practical.
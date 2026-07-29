# Indexing

Version: 2.0

---

# Purpose

The indexing package is responsible for discovering and understanding an
existing TagSpaces library.

Its output is an in-memory representation of the media library that can be used
by the search engine and the backend.

The indexer never modifies the original library.

---

# Responsibilities

The indexer is responsible for:

- discovering videos recursively
- locating TagSpaces sidecar metadata
- locating TagSpaces thumbnails
- extracting tag information
- producing a searchable in-memory index

The indexer does not perform searches or serve media files.

---

# Read-only Guarantee

The indexing process must never:

- modify video files
- modify TagSpaces metadata
- modify thumbnails
- rename files
- move files
- delete files

The original TagSpaces library remains the single source of truth.

---

# Input

The indexer receives a library root directory.

Example:

```text
D:\baile
```

The library contains:

- videos
- TagSpaces JSON metadata
- TagSpaces thumbnails

No additional project-specific files are required.

---

# Output

The result of indexing is a collection of indexed videos.

Each indexed video contains the information required by the rest of the
application.

Typical fields include:

- unique identifier
- filename
- original video path
- thumbnail path (if available)
- metadata path (if available)
- extracted tags

The original metadata is not exposed directly.

Only the information needed by the application is extracted.

---

# Indexing Flow

```text
Library root

↓

Discover videos

↓

Locate TagSpaces metadata

↓

Extract tags

↓

Locate thumbnails

↓

Build in-memory index
```

---

# Error Handling

Indexing should continue whenever possible.

Examples:

- missing metadata
- missing thumbnail
- invalid metadata

These situations affect only the corresponding video.

They must never interrupt indexing of the rest of the library.

---

# Performance

Indexing is expected to happen infrequently.

Searching should never scan the filesystem.

Instead:

```text
Index once

↓

Search many times

↓

Stream from original files
```

The generated index becomes the source used by the search engine.

When a video is selected, the backend streams the original media file directly
from the library.

---

# Future Evolution

The internal representation of the index may evolve over time.

Possible improvements include:

- persistent indexes
- incremental indexing
- automatic reindexing
- additional metadata extraction

These improvements must preserve the read-only guarantee.

---

# Responsibilities Summary

Indexer

- discovers videos
- extracts metadata
- extracts tags
- builds the index

Search package

- queries the index

Backend

- exposes the index through the REST API
- streams original media files

Frontend

- consumes the REST API
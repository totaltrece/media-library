# Indexing Architecture

Version: 1.0

---

# Purpose

The index is the core of Media Library.

Its purpose is to transform a TagSpaces media library into a searchable
representation optimized for fast queries.

The indexing process is completely read-only.

No source file is ever modified.

---

# Source of Truth

The original media library is always the source of truth.

Media Library never owns the data.

The index is only a derived representation built from:

- video files
- TagSpaces JSON sidecar files
- TagSpaces thumbnails

If the original library changes, the index can always be rebuilt.

---

# Indexing Process

The indexing process performs the following steps.

1. Discover video files.
2. Locate TagSpaces metadata.
3. Read metadata.
4. Extract searchable information.
5. Build the internal index.

After indexing, searches operate only on the generated index.

---

# Search Process

Searching never scans the filesystem.

Instead, every search is executed against the current index.

This guarantees predictable and fast search performance regardless of the number
of queries.

---

# Indexed Information

Version 1.0 indexes:

- video filename
- relative path
- thumbnail
- tags

Future versions may include additional searchable fields.

---

# Index Lifecycle

The application maintains one active index.

The lifecycle is:

```text
Application starts

↓

Index library

↓

Serve searches

↓

Reindex (optional)

↓

Replace old index
```

The previous index remains available until a new one has been successfully built.

---

# Reindexing

Reindexing is an explicit operation.

It rebuilds the complete index from the original TagSpaces library.

A failed reindex must never leave the application without a valid index.

The previous index remains active until the replacement is ready.

---

# Read-only Guarantee

The indexing process may:

- read directories
- read metadata
- read thumbnails

It must never:

- write metadata
- rename files
- delete files
- modify thumbnails

---

# Error Handling

Individual metadata errors should not stop indexing.

Examples:

- missing metadata
- invalid JSON
- unsupported files

The indexer should continue whenever possible and report errors for diagnostic
purposes.

---

# Performance Goals

The indexing process is expected to be significantly slower than searching.

This is acceptable because indexing happens infrequently.

Searches should remain responsive regardless of library size.

---

# Future Evolution

Future versions may introduce:

- persistent indexes
- incremental indexing
- background indexing
- filesystem monitoring

These improvements must not change the public behaviour of the application.

Searching should continue to operate independently of the original filesystem.

---

# Design Principles

The indexing subsystem should remain:

- deterministic
- reproducible
- read-only
- independent from HTTP
- independent from the user interface

---

# Cursor Notes

Before modifying the indexing system:

- Read AGENTS.md.
- Read docs/00-vision.md.
- Preserve the read-only guarantee.
- Keep indexing independent from searching.
- Add regression tests for every bug fix.
- Avoid introducing persistence unless required by the current milestone.
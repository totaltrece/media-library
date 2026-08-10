# Indexer Prompt

You are working on the indexing package.

Before writing code:

- Read AGENTS.md.
- Read docs/07-development-rules.md.
- Read docs/05-indexing.md.

The indexer discovers and understands an existing TagSpaces library.

It never modifies media.

Responsibilities include:

- discovering videos
- locating TagSpaces metadata
- extracting tags
- locating thumbnails
- building the in-memory index

The indexer must remain read-only.

Invalid metadata must never interrupt indexing.

Prefer deterministic behaviour.

Add regression tests whenever fixing parsing bugs.

Keep filesystem access isolated inside the indexer package.
# Search Prompt

You are working on the search package.

Before writing code:

- Read AGENTS.md.
- Read docs/07-development-rules.md.

The search package operates exclusively on indexed data.

It never scans the filesystem.

It never performs HTTP operations.

It never knows where media files are stored.

Responsibilities include:

- searching
- filtering
- ranking (future)
- sorting (future)

Keep search functions pure.

Avoid side effects.

Write behaviour-based tests.

Preserve deterministic ordering whenever possible.
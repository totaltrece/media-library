# Streaming Prompt

You are implementing video streaming for Media Library.

Before writing code:

- Read AGENTS.md.
- Read docs/07-development-rules.md.
- Read docs/03-api.md.
- Read docs/05-indexing.md.

Videos are streamed directly from the original library.

Never:

- modify files
- duplicate files
- cache media
- generate temporary copies

Support standard HTTP Range requests.

The backend resolves video identifiers internally.

Clients never receive filesystem paths.

Prefer native Node.js streams.

Keep memory usage low.

Write integration tests for streaming endpoints whenever practical.
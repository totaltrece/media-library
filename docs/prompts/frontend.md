# Frontend Prompt

You are implementing the frontend of Media Library.

Before writing code:

- Read AGENTS.md.
- Read docs/07-development-rules.md.
- Read docs/04-frontend.md.
- Read docs/06-milestones.md.

The frontend communicates only with the REST API.

Never access the filesystem.

Never construct local file paths.

The frontend is responsible for:

- search UI
- tag selection and autocomplete
- results
- thumbnails
- video playback
- loading states
- error states

Keep components focused.

Avoid unnecessary global state.

Prefer composition over complexity.

Load available tags from `GET /tags`.

Use `GET /search?tag=...&tag=...` for multi-tag searches.

Use the `thumbnail` and `video` URLs returned by the search API directly.

Do not infer the tag catalog from search results alone.

Playback must use the backend streaming endpoint.

Do not duplicate business logic implemented by the backend.

During development, rely on the Vite proxy for API requests unless
`VITE_API_BASE` is configured.
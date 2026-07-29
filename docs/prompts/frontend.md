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
- results
- thumbnails
- video playback
- loading states
- error states

Keep components focused.

Avoid unnecessary global state.

Prefer composition over complexity.

Playback must use the backend streaming endpoint.

Do not duplicate business logic implemented by the backend.
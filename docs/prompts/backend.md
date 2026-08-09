# Backend Prompt

You are implementing the backend of Media Library.

Before writing code:

- Read AGENTS.md.
- Read docs/07-development-rules.md.
- Read docs/03-api.md.
- Read docs/06-milestones.md.

The backend is responsible for:

- exposing the REST API
- invoking application services
- serving JSON responses
- listing indexed tags
- streaming media
- hiding filesystem details

Do not place business logic inside HTTP handlers.

Business logic belongs in the application layer.

Filesystem access belongs to adapters.

Implement only the requested milestone.

Do not anticipate future milestones.

Keep handlers small and easy to read.

Return clear HTTP status codes.

Write or update tests whenever behaviour changes.

Do not expose physical filesystem paths through the API.
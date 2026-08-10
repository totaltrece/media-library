# AGENTS.md

## Project Overview

Media Library is a read-only application for browsing and querying multimedia
libraries tagged with TagSpaces. It must never modify videos, media files, or
TagSpaces metadata. The repository is a TypeScript monorepo managed with pnpm
and Turborepo.

## Goals

- Provide a reliable way to discover and query tagged media.
- Preserve the source library at all times: reading and indexing must be
  non-destructive.
- Keep the domain model independent from delivery mechanisms and infrastructure.
- Make backend, frontend, and shared packages easy to evolve independently.
- Prefer small, understandable changes over premature abstraction.

## Architecture

Use hexagonal architecture (ports and adapters) as the project evolves.

- **Domain:** business concepts, rules, and types. It must not depend on
  frameworks, databases, filesystems, HTTP, or UI libraries.
- **Application:** use cases that coordinate domain logic through explicit
  input/output ports.
- **Ports:** TypeScript interfaces describing capabilities required by use cases
  (for example, searching indexed media or reading TagSpaces metadata).
- **Adapters:** implementations of ports for filesystem access, indexing,
  persistence, HTTP, or presentation. Adapters depend inward; the domain does
  not depend outward.
- **Composition root:** application entry points wire concrete adapters to
  application services. Keep dependency construction at the edge of each app.

Do not couple domain or application code directly to transport, persistence, or
framework-specific types. Keep TagSpaces and filesystem integration behind
adapters, and preserve the read-only guarantee in every implementation.

## Monorepo Structure

```text
backend/             Backend application and its composition root
frontend/            Frontend application
packages/
  indexer/           Media-library indexing package
  shared/            Shared cross-cutting types and utilities
docs/                Product and architecture documentation
decisions/           Architecture Decision Records (ADRs)
samples/             Non-production sample data
tools/               Repository tooling
```

The workspace uses `pnpm` and Turborepo. Root scripts orchestrate workspace
tasks; package-specific commands should be used when work is limited to one
package. Before moving code between packages, ensure the dependency direction
still matches the architecture and that the package has a clear responsibility.

## Coding Standards

- Write code, comments, documentation, identifiers, and commit messages in
  English.
- Follow `.editorconfig`: two spaces for indentation and a final newline.
- Keep modules focused and names explicit. Prefer clear code over clever code.
- Avoid unrelated formatting changes and broad mechanical rewrites.
- Handle expected failures deliberately; do not silently ignore errors.
- Treat media files and TagSpaces metadata as immutable inputs. Any operation
  that could write, rename, delete, or alter them is out of scope.
- Update relevant documentation or ADRs when an agreed architectural decision
  changes.

## TypeScript Conventions

- TypeScript is strict (`strict: true`); do not weaken compiler settings to
  accommodate a change.
- Prefer explicit public API types and narrow, well-named domain types.
- Avoid `any`. Use `unknown` at untrusted boundaries and validate or narrow it
  before use.
- Prefer `interface` for ports and object-shaped contracts; use `type` for
  unions, aliases, and composition where it is clearer.
- Model invalid or absent states explicitly rather than relying on unchecked
  casts or non-null assertions.
- Keep side effects at adapter and entry-point boundaries. Make domain and use
  case logic deterministic and straightforward to test.
- Use ESM-compatible imports and follow the repository TypeScript configuration
  (`module: NodeNext`, `target: ES2022`).

## Git Conventions

- Make small, cohesive commits that each compile and are safe to review.
- Use Conventional Commit-style messages, for example:
  `feat(indexer): add media discovery port` or `fix(backend): validate query`.
- Do not mix refactors, formatting, and behavioral changes in the same commit
  unless they are inseparable.
- Do not rewrite, discard, or overwrite existing user changes without explicit
  permission.

## Rules and Change Boundaries

- Do not change the hexagonal architecture or dependency direction without an
  explicit discussion and an ADR when appropriate.
- Do not add dependencies unless they are necessary for the requested work and
  the benefit outweighs the maintenance cost. Prefer existing platform and
  workspace capabilities first.
- Ask before large refactors, package reorganization, public API changes, or
  changes that affect multiple architectural layers.
- Keep changes scoped to the requested outcome. Flag assumptions and risks when
  requirements are incomplete.
- Never introduce writes to source media or TagSpaces files.

## Testing Philosophy

- Test behaviour and contracts, not implementation details.
- Prioritize fast unit tests for domain and application use cases.
- Add integration tests at adapter boundaries for filesystem, indexing, and
  transport behavior, using isolated fixtures and temporary data.
- Cover read-only guarantees and error handling whenever a change touches file
  access or indexing.
- Every bug fix should include a regression test when practical.
- Keep tests deterministic; do not require personal media libraries, network
  access, or mutable shared state.

## Development Workflow

1. Read the relevant code, documentation, and ADRs before changing behavior.
2. Confirm the smallest package and architectural layer affected.
3. Implement the smallest cohesive change while keeping dependencies inward.
4. Add or update tests with the implementation.
5. Run the applicable checks:

   ```bash
   pnpm build
   pnpm lint
   pnpm test
   ```

   Run a narrower package-level command first when available; use root commands
   before handoff when the change affects multiple packages.
6. Review the diff for scope, generated files, accidental formatting, and the
   read-only guarantee.
7. Commit the change in a small, descriptive commit when asked to commit.

## Definition of Done

A change is done when:

- The requested behavior is implemented and scoped appropriately.
- Hexagonal boundaries and read-only constraints are preserved.
- Relevant tests are added or updated and the applicable checks pass.
- TypeScript remains strict and no unnecessary dependency was added.
- Documentation and ADRs reflect any agreed architectural or workflow change.
- The diff is focused, readable, and free from unrelated modifications.
- Any limitations, deferred work, or checks that could not run are clearly
  reported.

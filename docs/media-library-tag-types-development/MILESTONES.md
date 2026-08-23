# Milestones — Tag types

Status: implemented.

## Decisions

- Type names are English: `type`, `style`, `teacher`, `location`, `resource`.
- The initial classification is a one-time seed. Tags can be reassigned later.
- Deleting a type is blocked while any tag still uses it.
- `resource` has `is_default = 1`. It can be renamed and recolored, never
  deleted, and new tags always use it.
- Sort-by-type uses seed `sort_order`: type → style → teacher → location →
  resource. Newly created types are appended.
- Colors: type `#c0392b`, style `#f1948a`, teacher `#27ae60`, location
  `#8d6e63`, resource `#93c5fd`.
- Color picker: Vue 3-friendly library chosen at implementation time.

## Objective

Give every catalog tag a type with a color, show that color in the video grid
and tag admin, allow sorting tags by type, and add a configuration screen for
types.

TagSpaces metadata and source media stay read-only.

## M1 — SQLite schema and seed

- Add `tag_types` (`id`, `name`, `color`, `is_default`, `sort_order`).
- Add `tags.tag_type_id` NOT NULL with a foreign key to `tag_types`.
- Migration compatible with existing databases (no data loss).
- Seed the five initial types.
- Classify existing tags by name (case-insensitive); unmatched tags become
  `resource`.
- Import / refresh / `upsertTag` create new tags as `resource`.

## M2 — API

- CRUD for tag types under `/api/admin/tag-types`.
- Extend `GET /api/admin/tags` and `PUT /api/admin/tags/:id` with type.
- Expose colors on `GET /api/tags` so catalog chips can be colored.
- Creating a tag via video tag APIs assigns the default resource type.

## M3 — Catalog UI colors and sort

- Color chips on the video catalog (thumbnails, player, suggestions).
- Color chips on `/admin/tags`.
- Sort-by-type control next to A-Z / Usage.

## M4 — Tag edit modal

- Pencil on `/admin/tags` opens a modal (same pattern as delete).
- Fields: name and type selector.
- No inline rename input.

## M5 — Tag type configuration

- New admin section in the header.
- List types; add, rename, change color, delete.
- Dropdown color picker from a well-known library.

### Completion

Types persist in SQLite, chips use type colors, tags can be retyped from the
modal, new tags default to resource, and types can be managed from the new
section. Tests, typecheck, and build pass.

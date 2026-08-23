# Media Library — Tag types

Add typed tags so the catalog can color chips by category (dance type, style,
teacher, location, resource) instead of using a single blue.

Documents:
- `MILESTONES.md` — implementation slices and agreed decisions

The physical library and TagSpaces files remain read-only. Types live in SQLite
with the existing tag catalog.

## Goal

- Each tag belongs to one type.
- Each type has a name and a color.
- Video chips and the tag admin catalog use that color.
- Tag admin can sort by type.
- A configuration screen manages types (create, rename, recolor, delete).
- Editing a tag opens a modal (name + type), not an inline input.
- Newly created tags default to the resource type.

## Initial types (seed)

| Type | Color | Initial tags |
| --- | --- | --- |
| type | `#c0392b` | salsa, bachata |
| style | `#f1948a` | on2, linea, rueda, dominicana, sensual, tradicional |
| teacher | `#27ae60` | jota, estela, gabriela, pascual, dani, isa, irene, javi |
| location | `#8d6e63` | host, sonando, pamplona, fdm, ermita, fdem |
| resource | `#93c5fd` | every other existing tag |

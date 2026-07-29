# REST API

Version: 1.0

---

# Purpose

This document defines the public HTTP API exposed by the Media Library backend.

The API is intentionally small.

Its primary purpose is to allow the frontend to browse a TagSpaces media library
through a read-only interface.

All responses use JSON.

---

# General Principles

The API:

- is read-only
- never modifies the media library
- never modifies TagSpaces metadata
- is stateless
- uses UTF-8 JSON

---

# Base URL

```
http://localhost:3000
```

---

# Endpoints

Version 1.0 provides the following endpoints.

| Method | Endpoint | Description |
|----------|----------|-------------|
| GET | /health | Backend status |
| GET | /stats | Library statistics |
| GET | /search | Search videos |
| POST | /reindex | Rebuild the internal index |

---

# GET /health

Returns the backend status.

## Response

```json
{
  "status": "ok"
}
```

HTTP Status

```
200 OK
```

---

# GET /stats

Returns general information about the indexed library.

## Response

```json
{
  "videos": 352,
  "tags": 146,
  "indexedAt": "2026-08-04T18:21:03Z"
}
```

Fields

| Field | Description |
|--------|-------------|
| videos | Number of indexed videos |
| tags | Number of unique tags |
| indexedAt | Last successful indexing |

---

# GET /search

Searches the indexed library.

The backend never scans the filesystem while executing a search.

---

## Query Parameters

### tags

Comma-separated list of tags.

Example

```
GET /search?tags=salsa,bea
```

The search returns videos containing every requested tag.

Tag matching is case-insensitive.

---

## Successful Response

```json
{
  "count": 2,
  "results": [
    {
      "path": "20250630_193642391.TS.mp4",
      "thumbnail": "/thumbnails/20250630_193642391.TS.mp4.jpg",
      "tags": [
        "bachata",
        "bea",
        "damian",
        "top"
      ]
    }
  ]
}
```

---

## Response Fields

### count

Number of matching videos.

### results

Array of matching videos.

Each object contains:

| Field | Description |
|--------|-------------|
| path | Relative video path |
| thumbnail | Thumbnail URL |
| tags | Video tags |

---

## Empty Result

```json
{
  "count": 0,
  "results": []
}
```

---

# POST /reindex

Rebuilds the internal search index.

This operation reads the TagSpaces library again.

The original files are never modified.

---

## Successful Response

```json
{
  "status": "ok",
  "videos": 352
}
```

---

# Error Responses

Unexpected errors use the following format.

```json
{
  "error": {
    "message": "Internal Server Error"
  }
}
```

---

# HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid request |
| 404 | Resource not found |
| 500 | Internal server error |

---

# Versioning

Version 1.0 does not expose an explicit API version.

If breaking changes become necessary in the future, the API should move to a
versioned path.

Example

```
/api/v2/search
```

---

# Future Endpoints

The following endpoints are outside the scope of version 1.0 but may be added
later.

```
GET /tags

GET /video

GET /duplicates

GET /recent

GET /library

GET /config
```

---

# Design Rules

The API should remain:

- simple
- predictable
- read-only
- stable
- independent from the frontend implementation

---

# Cursor Notes

Before implementing API changes:

- Read AGENTS.md.
- Read docs/00-vision.md.
- Read docs/02-backend.md.
- Preserve backward compatibility whenever possible.
- Keep request and response models simple.
- Add integration tests for every endpoint.
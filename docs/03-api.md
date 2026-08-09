# REST API

Version: 2.0

---

# Purpose

The REST API is the only communication channel between clients and the Media
Library backend.

Clients never access the filesystem directly.

The API exposes search capabilities, thumbnails and video streaming using stable
media identifiers.

---

# Principles

The API should be:

- simple
- predictable
- read-only
- stateless

All responses use JSON except media streaming endpoints.

---

# Endpoints

## Health

```text
GET /health
```

Response

```json
{
  "status": "ok"
}
```

---

## Search

```text
GET /search?tag=salsa
```

Multiple tags:

```text
GET /search?tag=salsa&tag=bea
```

Response

```json
{
  "query": {
    "tags": [
      "salsa",
      "bea"
    ]
  },
  "count": 2,
  "results": [
    {
      "id": "bachata/20250630_193642391.TS.mp4",
      "name": "20250630_193642391.TS.mp4",
      "thumbnail": "/thumbnail/bachata/20250630_193642391.TS.mp4",
      "video": "/video/bachata/20250630_193642391.TS.mp4",
      "tags": [
        "y:2025",
        "m:06",
        "d:30",
        "bachata",
        "damian",
        "bea"
      ]
    }
  ]
}
```

---

## Tags

```text
GET /tags
```

Returns all distinct tags from the indexed library.

The backend never scans the filesystem while executing this request.

Response

```json
{
  "count": 3,
  "tags": [
    "bachata",
    "bea",
    "salsa"
  ]
}
```

Tags are unique and sorted alphabetically.

---

## Thumbnail

```text
GET /thumbnail/:id
```

Returns the existing TagSpaces thumbnail associated with the requested media.

If no thumbnail exists, the endpoint returns **404 Not Found**.

---

## Video

```text
GET /video/:id
```

Streams the original video from the media library.

The endpoint supports HTTP Range requests and is compatible with the HTML5
`<video>` element.

---

# Media Identifier

Every indexed video has a stable identifier.

The identifier is the relative path of the video inside the configured media
library.

Example:

```text
bachata/2025/course/PXL_20250630_193642391.TS.mp4
```

Clients treat the identifier as an opaque value.

They never construct or modify it.

---

# Error Responses

Errors use the following structure:

```json
{
  "error": {
    "message": "Video not found"
  }
}
```

---

# Responsibilities

Backend

- indexing
- searching
- tag listing
- identifier resolution
- thumbnail serving
- video streaming

Frontend

- sending search requests
- loading available tags
- displaying results
- displaying thumbnails
- playing streamed videos

Filesystem paths are never exposed to clients.
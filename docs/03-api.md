# REST API

Version: 2.1

---

# Purpose

The REST API is the only communication channel between clients and the Media
Library backend.

Clients never access the filesystem directly.

The API is exposed under the `/api` prefix. All endpoints below are relative to
that prefix.

The API exposes search capabilities, thumbnails and video streaming using stable
media identifiers.

---

# Principles

The API should be:

- simple
- predictable
- stateless

Tag editing writes to SQLite only. The API never modifies video files or
TagSpaces sidecars.

All responses use JSON except media streaming endpoints.

---

# Endpoints

## Health

```text
GET /api/health
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
GET /api/search?tag=salsa
```

Multiple tags:

```text
GET /api/search?tag=salsa&tag=bea
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
      "thumbnail": "/api/thumbnail/bachata/20250630_193642391.TS.mp4",
      "video": "/api/video/bachata/20250630_193642391.TS.mp4",
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
GET /api/tags
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

## Video tags

Media ids may contain slashes, so these routes use the same wildcard form as
thumbnails and video streaming. Tag names in `DELETE` are URL-decoded, so names
with spaces or reserved characters must be encoded.

```text
GET /api/videos/:id/tags
POST /api/videos/:id/tags
PUT /api/videos/:id/tags
DELETE /api/videos/:id/tags/:tag
```

`GET` returns the tags currently stored for that video, in order.

```json
{
  "tags": [
    "salsa",
    "isa",
    "jota",
    "codo"
  ]
}
```

`POST` appends one tag. If the tag does not exist in the catalog, it is created.
Repeating the same tag is idempotent and preserves order.

```json
{
  "name": "bufanda"
}
```

`PUT` replaces the complete list. Duplicates keep the first occurrence. Missing
catalog tags are created automatically.

```json
{
  "tags": [
    "salsa",
    "isa",
    "jota",
    "bufanda"
  ]
}
```

`DELETE` removes the video/tag relation. It does not delete the tag from the
global catalog. Removing a tag the video does not have is idempotent.

Editing a video that is not in SQLite returns **404 Not Found**. These endpoints
do not create videos.

---

## Library Refresh

```text
POST /api/library/refresh
```

Re-indexes the configured media library by discovering new video files on
`LIBRARY_PATH`, inserting any missing videos into SQLite without tags, and
replacing the in-memory video index from SQLite.

The endpoint does not read TagSpaces sidecars, modify existing tags, delete
SQLite videos that are missing from disk, or change video files. If refresh
fails, the existing in-memory index remains unchanged.

Response

```json
{
  "count": 123
}
```

---

## Thumbnail

```text
GET /api/thumbnail/:id
```

Returns the existing TagSpaces thumbnail associated with the requested media.

If no thumbnail exists, the endpoint returns **404 Not Found**.

---

## Video

```text
GET /api/video/:id
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
- tag editing in SQLite
- in-memory index refresh
- identifier resolution
- thumbnail serving
- video streaming

Frontend

- sending search requests
- loading available tags
- refreshing the indexed library
- displaying results
- displaying thumbnails
- playing streamed videos

Filesystem paths are never exposed to clients.
# Vision

Version: 2.1

---

# Purpose

Media Library is a self-hosted web application for browsing, searching, and
streaming a personal video library.

It allows signed-in users to search videos by tags stored in the application
database and watch them from other devices without copying the original media
files. TagSpaces is not part of the product architecture; it is only a
historical origin of the library.

The application is designed for personal use across devices connected to the
same network, while remaining extensible for future remote access.

---

# The Problem

The video files live on a dedicated machine. Tagging and playback should work
from tablets, phones, and other computers through a web browser, without
treating a third-party desktop tagger as the source of truth.

Media Library keeps metadata in its own database and streams files from the
library path. Existing media files are not rewritten except through explicit
admin operations.

---

# Goals

The application must:

- browse the library catalog in its own database
- search videos using application tags
- stream videos without copying them
- preserve existing media files except for explicit admin install/delete
- work from any device with a web browser
- remain simple to deploy on a home network or a hosted server

---

# Non Goals

Media Library is not intended to:

- integrate with TagSpaces or any other desktop tagger
- rename or move files outside admin install/delete
- become a generic media server for movies or TV shows

---

# Media files

Video files on disk remain the media source. Metadata (tags, types, users) is
the application database.

The application must not overwrite existing videos except through admin
upload installation or video delete. It must not read or write TagSpaces JSON
sidecars. Thumbnails may remain under `.ts/` as a filesystem layout only.

---

# Typical Workflow

```text
Sign in (`view` or `admin`)

↓

Search videos by tag

↓

Watch the selected video by streaming

↓

Admins edit tags and catalog in the application
```

---

# Target Environment

Typical deployment:

- Mini PC (AceMagic) and/or a Linux host
- Windows or Linux
- Video library stored on disk (`LIBRARY_PATH`)
- Fastify backend
- Vue frontend

Typical clients:

- Android tablet
- Android phone
- Windows laptop
- Any modern web browser

---

# Design Principles

Media Library should remain:

- read-only
- lightweight
- self-hosted
- easy to understand
- easy to maintain
- independent from TagSpaces

---

# Success Criteria

The MVP is successful when a signed-in user can:

1. open the web application from another device
2. search videos by tag
3. browse matching results
4. play a selected video directly in the browser
5. watch the video without downloading or copying it
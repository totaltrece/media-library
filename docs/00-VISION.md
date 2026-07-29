# Vision

Version: 2.0

---

# Purpose

Media Library is a self-hosted web application for browsing and streaming
TagSpaces video libraries.

It allows users to search videos by their TagSpaces tags and watch them from
other devices without copying or modifying the original media library.

The application is designed for personal use across devices connected to the
same network, while remaining extensible for future remote access.

---

# The Problem

TagSpaces provides an excellent way to organize videos using tags.

However, its primary workflow assumes that the media library is accessed
directly from the local machine.

Media Library solves a different problem.

It allows the original TagSpaces library to remain on a dedicated computer while
making the tagged videos easily accessible from tablets, phones or other
computers through a web browser.

The original organization and metadata remain entirely managed by TagSpaces.

---

# Goals

The application must:

- browse existing TagSpaces libraries
- search videos using TagSpaces tags
- stream videos without copying them
- preserve the original library
- work from any device with a web browser
- remain simple to deploy on a home network

---

# Non Goals

Media Library is not intended to:

- replace TagSpaces
- edit TagSpaces metadata
- organize media
- rename files
- move files
- import media into its own database
- become a media server for movies or TV shows

TagSpaces remains responsible for organizing and tagging the library.

---

# Read-only Philosophy

The original media library is the source of truth.

Media Library never modifies:

- video files
- TagSpaces JSON metadata
- TagSpaces thumbnails
- directory structure

All operations are strictly read-only.

---

# Typical Workflow

```text
Tag videos with TagSpaces

↓

Leave the library on the server PC

↓

Open Media Library from another device

↓

Search videos by tag

↓

Watch the selected video by streaming
```

---

# Target Environment

Typical deployment:

- Mini PC (AceMagic)
- Windows
- TagSpaces installed
- Video library stored locally
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
- independent from TagSpaces internals whenever possible

---

# Success Criteria

The MVP is successful when a user can:

1. open the web application from another device
2. search videos by tag
3. browse matching results
4. play a selected video directly in the browser
5. watch the video without downloading or copying it
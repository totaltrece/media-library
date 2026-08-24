import { describe, expect, it, vi } from "vitest";

import { buildApiUrl, buildSearchUrl, buildActiveUploadJobUrl, buildUploadJobUrl } from "../src/api/client.js";

describe("buildApiUrl", () => {
  it("prefixes relative API paths with /api", () => {
    expect(buildApiUrl("/tags")).toBe("/api/tags");
    expect(buildApiUrl("/thumbnail/salsa/first.mp4")).toBe("/api/thumbnail/salsa/first.mp4");
  });

  it("leaves absolute URLs unchanged", () => {
    expect(buildApiUrl("https://example.com/tags")).toBe("https://example.com/tags");
  });

  it("leaves already-prefixed API paths unchanged", () => {
    expect(buildApiUrl("/api/tags")).toBe("/api/tags");
    expect(buildApiUrl("/api/thumbnail/salsa/first.mp4")).toBe("/api/thumbnail/salsa/first.mp4");
  });
});

describe("buildSearchUrl", () => {
  it("builds repeated tag query parameters", () => {
    expect(buildSearchUrl(["salsa", "bea"])).toBe("/api/search?tag=salsa&tag=bea");
  });

  it("builds the search endpoint without tags", () => {
    expect(buildSearchUrl([])).toBe("/api/search");
  });
});

describe("refreshLibrary", () => {
  it("posts to the library refresh endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ count: 3 }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { refreshLibrary } = await import("../src/api/client.js");
    const response = await refreshLibrary();

    expect(fetchMock).toHaveBeenCalledWith("/api/library/refresh", { credentials: "include", method: "POST" });
    expect(response).toEqual({ count: 3 });

    vi.unstubAllGlobals();
  });
});

describe("video tags API", () => {
  it("builds video tag URLs from the media id", async () => {
    const { buildVideoTagsUrl } = await import("../src/api/client.js");

    expect(buildVideoTagsUrl("salsa/first.mp4")).toBe("/api/videos/salsa/first.mp4/tags");
  });

  it("loads and replaces video tags", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tags: ["salsa"] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tags: ["salsa", "bufanda"] }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchVideoTags, updateVideoTags } = await import("../src/api/client.js");

    await expect(fetchVideoTags("salsa/first.mp4")).resolves.toEqual({ tags: ["salsa"] });
    await expect(updateVideoTags("salsa/first.mp4", ["salsa", "bufanda"])).resolves.toEqual({
      tags: ["salsa", "bufanda"],
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/videos/salsa/first.mp4/tags", { credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/videos/salsa/first.mp4/tags", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ tags: ["salsa", "bufanda"] }),
    });

    vi.unstubAllGlobals();
  });

  it("deletes a video by media id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "salsa/first.mp4" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { buildVideoUrl, deleteVideo } = await import("../src/api/client.js");

    expect(buildVideoUrl("salsa/first.mp4")).toBe("/api/videos/salsa/first.mp4");
    await expect(deleteVideo("salsa/first.mp4")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith("/api/videos/salsa/first.mp4", { credentials: "include", method: "DELETE" });

    vi.unstubAllGlobals();
  });
});

describe("tag catalog API", () => {
  it("loads, renames, and deletes catalog tags", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          count: 1,
          tags: [{ id: 7, name: "salsa", usageCount: 12 }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 7, name: "salsa-linea", usageCount: 12 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 7 }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { deleteCatalogTag, fetchTagCatalog, updateCatalogTag } = await import("../src/api/client.js");

    await expect(fetchTagCatalog()).resolves.toEqual({
      count: 1,
      tags: [{ id: 7, name: "salsa", usageCount: 12 }],
    });
    await expect(updateCatalogTag(7, "salsa-linea", 3)).resolves.toEqual({
      id: 7,
      name: "salsa-linea",
      usageCount: 12,
    });
    await expect(deleteCatalogTag(7)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/tags", { credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/tags/7", {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ name: "salsa-linea", typeId: 3 }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/tags/7", { credentials: "include", method: "DELETE" });

    vi.unstubAllGlobals();
  });
});

describe("admin uploads API", () => {
  it("posts the video as multipart without setting content-type", async () => {
    const file = new File(["bytes"], "clip.mp4", { type: "video/mp4" });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({ jobId: "job-1", status: "uploading" }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { uploadVideo } = await import("../src/api/client.js");
    await expect(uploadVideo(file)).resolves.toEqual({ jobId: "job-1", status: "uploading" });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/uploads", {
      credentials: "include",
      method: "POST",
      body: expect.any(FormData),
    });
    const body = fetchMock.mock.calls[0]?.[1]?.body as FormData;
    expect(body.get("video")).toBe(file);

    vi.unstubAllGlobals();
  });

  it("loads upload job status from the job URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jobId: "job-1",
        status: "processing",
        phase: "generating_thumbnail",
        videoId: "clip.mp4",
        converted: true,
        outputs: null,
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchUploadJob } = await import("../src/api/client.js");

    expect(buildUploadJobUrl("job-1")).toBe("/api/admin/uploads/job-1");
    await expect(fetchUploadJob("job-1")).resolves.toMatchObject({
      jobId: "job-1",
      status: "processing",
      phase: "generating_thumbnail",
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/uploads/job-1", { credentials: "include" });

    vi.unstubAllGlobals();
  });

  it("loads the active upload job or null when none exists", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: "No active upload job." } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          jobId: "job-1",
          status: "processing",
          phase: "processing",
          videoId: "clip.mp4",
          converted: true,
          progress: 47,
          outputs: null,
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { fetchActiveUploadJob } = await import("../src/api/client.js");

    expect(buildActiveUploadJobUrl()).toBe("/api/admin/uploads/active");
    await expect(fetchActiveUploadJob()).resolves.toBeNull();
    await expect(fetchActiveUploadJob()).resolves.toMatchObject({
      jobId: "job-1",
      progress: 47,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/uploads/active", { credentials: "include" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/uploads/active", { credentials: "include" });

    vi.unstubAllGlobals();
  });
});

import { describe, expect, it, vi } from "vitest";

import { buildApiUrl, buildSearchUrl } from "../src/api/client.js";

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

    expect(fetchMock).toHaveBeenCalledWith("/api/library/refresh", { method: "POST" });
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

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/videos/salsa/first.mp4/tags");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/videos/salsa/first.mp4/tags", {
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ tags: ["salsa", "bufanda"] }),
    });

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

    const { deleteCatalogTag, fetchTagCatalog, renameCatalogTag } = await import("../src/api/client.js");

    await expect(fetchTagCatalog()).resolves.toEqual({
      count: 1,
      tags: [{ id: 7, name: "salsa", usageCount: 12 }],
    });
    await expect(renameCatalogTag(7, "salsa-linea")).resolves.toEqual({
      id: 7,
      name: "salsa-linea",
      usageCount: 12,
    });
    await expect(deleteCatalogTag(7)).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/tags");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/tags/7", {
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ name: "salsa-linea" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/admin/tags/7", { method: "DELETE" });

    vi.unstubAllGlobals();
  });
});

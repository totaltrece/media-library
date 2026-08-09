import { describe, expect, it } from "vitest";

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

import { describe, expect, it } from "vitest";

import { buildApiUrl, buildSearchUrl } from "../src/api/client.js";

describe("buildApiUrl", () => {
  it("returns relative API paths unchanged by default", () => {
    expect(buildApiUrl("/tags")).toBe("/tags");
    expect(buildApiUrl("/thumbnail/salsa/first.mp4")).toBe("/thumbnail/salsa/first.mp4");
  });
});

describe("buildSearchUrl", () => {
  it("builds repeated tag query parameters", () => {
    expect(buildSearchUrl(["salsa", "bea"])).toBe("/search?tag=salsa&tag=bea");
  });

  it("builds the search endpoint without tags", () => {
    expect(buildSearchUrl([])).toBe("/search");
  });
});

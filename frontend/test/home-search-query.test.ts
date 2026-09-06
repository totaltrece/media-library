import { describe, expect, it } from "vitest";

import { homeSearchQuery, parseRouteTags, sameTags } from "../src/utils/home-search-query.js";

describe("home search query", () => {
  it("parses a single tag, repeated tags, and empty values", () => {
    expect(parseRouteTags("salsa")).toEqual(["salsa"]);
    expect(parseRouteTags(["salsa", "noria"])).toEqual(["salsa", "noria"]);
    expect(parseRouteTags(["", "salsa", null])).toEqual(["salsa"]);
    expect(parseRouteTags(undefined)).toEqual([]);
  });

  it("builds a shareable query for tags or the untagged filter", () => {
    expect(homeSearchQuery([], false)).toEqual({});
    expect(homeSearchQuery(["salsa"], false)).toEqual({ tag: "salsa" });
    expect(homeSearchQuery(["salsa", "noria"], false)).toEqual({ tag: ["salsa", "noria"] });
    expect(homeSearchQuery(["salsa"], true)).toEqual({ untagged: "1" });
  });

  it("compares tag lists in order", () => {
    expect(sameTags(["salsa", "noria"], ["salsa", "noria"])).toBe(true);
    expect(sameTags(["salsa", "noria"], ["noria", "salsa"])).toBe(false);
  });
});

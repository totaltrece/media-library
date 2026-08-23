import { describe, expect, it } from "vitest";

import { contrastingTextColor, tagChipStyle } from "../src/utils/tag-color.js";

describe("tag colors", () => {
  it("uses dark text on light chips and light text on dark chips", () => {
    expect(contrastingTextColor("#93c5fd")).toBe("#202124");
    expect(contrastingTextColor("#c0392b")).toBe("#ffffff");
    expect(tagChipStyle("#27ae60")).toEqual({
      backgroundColor: "#27ae60",
      color: "#ffffff",
    });
  });
});

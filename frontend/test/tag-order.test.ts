import { describe, expect, it } from "vitest";

import { sortTagsByType } from "../src/utils/tag-order.js";

describe("sortTagsByType", () => {
  it("orders tags by type then name, using the fallback for unknown tags", () => {
    expect(
      sortTagsByType(
        ["isa", "bufanda", "salsa", "linea", "nuevo"],
        {
          salsa: 1,
          linea: 2,
          isa: 3,
          bufanda: 5,
        },
        5,
      ),
    ).toEqual(["salsa", "linea", "isa", "bufanda", "nuevo"]);
  });
});

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import type { SearchResultItem } from "../src/api/types.js";
import SearchResults from "../src/components/SearchResults.vue";

function video(id: string, recordedAt: string | null): SearchResultItem {
  return {
    id,
    name: id,
    thumbnail: `/api/thumbnail/${id}`,
    video: `/api/video/${id}`,
    tags: ["salsa"],
    recordedAt,
  };
}

describe("SearchResults date sort", () => {
  const results = [
    video("new.mp4", "2026-03-14T19:00:00.000Z"),
    video("old.mp4", "2024-10-16T18:00:00.000Z"),
    video("mid.mp4", "2025-12-27T19:00:00.000Z"),
  ];

  it("orders videos from oldest to newest by default", () => {
    const wrapper = mount(SearchResults, {
      props: {
        results,
        searched: true,
        selectedVideoId: null,
        showName: true,
      },
    });

    expect(wrapper.get("h2").text()).toBe("3 results");
    expect(wrapper.get('[data-testid="sort-date"]').text()).toContain("↓");
    expect(wrapper.findAll(".result-card-name").map((name) => name.text())).toEqual([
      "old.mp4",
      "mid.mp4",
      "new.mp4",
    ]);
  });

  it("toggles to newest first when the date sort button is clicked", async () => {
    const wrapper = mount(SearchResults, {
      props: {
        results,
        searched: true,
        selectedVideoId: null,
        showName: true,
      },
    });

    await wrapper.get('[data-testid="sort-date"]').trigger("click");

    expect(wrapper.get('[data-testid="sort-date"]').text()).toContain("↑");
    expect(wrapper.get('[data-testid="sort-date"]').attributes("aria-label")).toBe("Sort by date, newest first");
    expect(wrapper.findAll(".result-card-name").map((name) => name.text())).toEqual([
      "new.mp4",
      "mid.mp4",
      "old.mp4",
    ]);
  });
});

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SearchResultItem from "../src/components/SearchResultItem.vue";
import type { SearchResultItem as SearchResult } from "../src/api/types.js";

function result(partial: Partial<SearchResult> = {}): SearchResult {
  return {
    id: "PXL_20260314_200431123.mp4",
    name: "PXL_20260314_200431123.mp4",
    thumbnail: "/api/thumbnail/PXL_20260314_200431123.mp4",
    video: "/api/video/PXL_20260314_200431123.mp4",
    tags: ["salsa"],
    recordedAt: new Date(2026, 2, 14, 20, 4, 31).toISOString(),
    ...partial,
  };
}

describe("SearchResultItem date overlay", () => {
  it("shows the date from recordedAt, not the filename", () => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: result({
          name: "1000141506.mp4",
          recordedAt: new Date(2026, 2, 14, 20, 4, 31).toISOString(),
        }),
        selected: false,
      },
    });

    expect(wrapper.get(".result-card-date").text()).toBe("14 03 2026");
    expect(wrapper.text()).not.toContain("XX XX XXXX");
  });

  it("hides the overlay when recordedAt is null", () => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: result({
          name: "PXL_20260314_200431123.mp4",
          recordedAt: null,
        }),
        selected: false,
      },
    });

    expect(wrapper.find(".result-card-date").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("14 03 2026");
    expect(wrapper.text()).not.toContain("XX XX XXXX");
  });

  it("turns the filename into an edit link when requested", () => {
    const wrapper = mount(SearchResultItem, {
      props: {
        result: result({ name: "clip.mp4" }),
        selected: false,
        showName: true,
        nameLinksToEdit: true,
      },
      global: {
        stubs: {
          RouterLink: {
            props: ["to"],
            template: '<a class="result-card-name-link" v-bind="$attrs"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.get(".result-card-name-link").text()).toBe("Edit video");
    expect(wrapper.get(".result-card-name-link").attributes("aria-label")).toBe("Edit tags for clip.mp4");
    expect(wrapper.text()).not.toContain("clip.mp4");
  });
});

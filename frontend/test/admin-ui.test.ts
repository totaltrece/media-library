import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

import type { SearchResultItem } from "../src/api/types.js";
import TagEditor from "../src/components/TagEditor.vue";
import TagSearch from "../src/components/TagSearch.vue";
import { routes } from "../src/router.js";
import AdminVideoEditView from "../src/views/AdminVideoEditView.vue";
import AdminVideosView from "../src/views/AdminVideosView.vue";
import { catalogTag, seedTagTypes, tagItems } from "./tag-fixtures.js";

const videos: SearchResultItem[] = [
  {
    id: "untagged.mp4",
    name: "20260801_new.mp4",
    thumbnail: "/api/thumbnail/untagged.mp4",
    video: "/api/video/untagged.mp4",
    tags: [],
    recordedAt: null,
  },
  {
    id: "salsa/first.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa/first.mp4",
    video: "/api/video/salsa/first.mp4",
    tags: ["salsa", "isa"],
    recordedAt: null,
  },
];

const catalogVideos: SearchResultItem[] = [
  {
    id: "untagged.mp4",
    name: "20260801_new.mp4",
    thumbnail: "/api/thumbnail/untagged.mp4",
    video: "/api/video/untagged.mp4",
    tags: [],
    recordedAt: null,
  },
  {
    id: "name-only-zenit.mp4",
    name: "zenit-practice.mp4",
    thumbnail: "/api/thumbnail/name-only-zenit.mp4",
    video: "/api/video/name-only-zenit.mp4",
    tags: ["salsa"],
    recordedAt: null,
  },
  {
    id: "tagged-zenit.mp4",
    name: "20260715.mp4",
    thumbnail: "/api/thumbnail/tagged-zenit.mp4",
    video: "/api/video/tagged-zenit.mp4",
    tags: ["zenit"],
    recordedAt: null,
  },
  {
    id: "salsa-jota.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa-jota.mp4",
    video: "/api/video/salsa-jota.mp4",
    tags: ["salsa", "jota"],
    recordedAt: null,
  },
];

const catalogTags = ["isa", "jota", "salsa", "zenit"];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function adminEditorResponse(url: string): Response | null {
  if (url === "/api/admin/tag-types") {
    return jsonResponse(seedTagTypes);
  }

  if (url === "/api/tags") {
    return jsonResponse({
      count: 3,
      tags: tagItems("bufanda", "isa", "salsa"),
    });
  }

  if (url === "/api/admin/tags") {
    return jsonResponse({
      count: 3,
      tags: [
        catalogTag({ id: 1, name: "bufanda" }),
        catalogTag({
          id: 2,
          name: "isa",
          typeId: 3,
          typeName: "teacher",
          color: "#27ae60",
          typeSortOrder: 3,
        }),
        catalogTag({
          id: 3,
          name: "salsa",
          typeId: 1,
          typeName: "type",
          color: "#c0392b",
          typeSortOrder: 1,
        }),
      ],
    });
  }

  return null;
}

function createCatalogFetchMock(
  searchHandler: (url: string) => SearchResultItem[] | null = () => null,
) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/tags") {
      return jsonResponse({ count: catalogTags.length, tags: tagItems(...catalogTags) });
    }

    const searched = searchHandler(url);

    if (searched !== null) {
      const tags = [...new URLSearchParams(url.split("?")[1] ?? "").getAll("tag")];
      return jsonResponse({ query: { tags }, count: searched.length, results: searched });
    }

    if (url === "/api/search") {
      return jsonResponse({ query: { tags: [] }, count: catalogVideos.length, results: catalogVideos });
    }

    return jsonResponse({ error: { message: "Not found" } }, false, 404);
  });
}

async function addSearchTags(wrapper: VueWrapper, tags: string[]): Promise<void> {
  const input = wrapper.get("#tag-input");

  for (const tag of tags) {
    await input.setValue(tag);
    await input.trigger("focus");
    await nextTick();

    const suggestion = wrapper.findAll(".tag-suggestions button").find((button) => button.text() === tag);
    expect(suggestion, `missing suggestion for ${tag}`).toBeDefined();
    await suggestion!.trigger("click");
    await flushPromises();
  }
}

function createTestRouter(initialPath = "/"): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

function mountWithRouter(component: unknown, router: Router, props?: Record<string, unknown>) {
  return mount(component as never, {
    props: props as never,
    global: {
      plugins: [router],
    },
  });
}

describe("admin video list", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows every video on the first load", async () => {
    const fetchMock = createCatalogFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
    expect(wrapper.text()).toContain("4 results");
    expect(wrapper.text()).toContain("Untagged (1)");
    expect(wrapper.text()).toContain("20260801_new.mp4");
    expect(wrapper.text()).toContain("zenit-practice.mp4");
    expect(wrapper.text()).toContain("20260715.mp4");
    expect(wrapper.text()).toContain("first.mp4");
  });

  it("links to the upload page instead of embedding the upload zone", async () => {
    vi.stubGlobal("fetch", createCatalogFetchMock());

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    expect(wrapper.get('[data-testid="upload-new-video"]').text()).toBe("Upload video");
    expect(wrapper.get('[data-testid="nav-view"]').classes()).toContain("active");
    expect(wrapper.find('[data-testid="upload-file-input"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="upload-select"]').exists()).toBe(false);
  });

  it("refreshes the library from the admin video catalog", async () => {
    const catalogFetch = createCatalogFetchMock();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/library/refresh" && init?.method === "POST") {
        return jsonResponse({ count: catalogVideos.length });
      }

      return catalogFetch(input, init);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await wrapper.get('button[aria-label="Refresh library"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/library/refresh", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/search");
    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(wrapper.text()).toContain("4 results");
  });

  it("searches by tag through the same /api/search mechanism as the consumer view", async () => {
    const zenitVideo = catalogVideos.find((video) => video.id === "tagged-zenit.mp4")!;
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=zenit") {
        return [zenitVideo];
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["zenit"]);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=zenit");
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("20260715.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");
    expect(wrapper.text()).not.toContain("20260801_new.mp4");
  });

  it("keeps AND behavior when several tags are selected", async () => {
    const bothTagsVideo = catalogVideos.find((video) => video.id === "salsa-jota.mp4")!;
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=salsa&tag=jota") {
        return [bothTagsVideo];
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["salsa", "jota"]);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa&tag=jota");
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("first.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");
  });

    it("opens the video player from the thumbnail", async () => {
    vi.stubGlobal("fetch", createCatalogFetchMock());

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await wrapper.get('button[aria-label="Play video tagged zenit"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[aria-label="Video player"]').exists()).toBe(true);
    expect(router.currentRoute.value.name).toBe("home");
  });

  it("opens the tag editor for a search result", async () => {
    const zenitVideo = catalogVideos.find((video) => video.id === "tagged-zenit.mp4")!;
    vi.stubGlobal(
      "fetch",
      createCatalogFetchMock((url) => (url === "/api/search?tag=zenit" ? [zenitVideo] : null)),
    );

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["zenit"]);
    await flushPromises();
    await wrapper.get('a[aria-label="Edit tags for 20260715.mp4"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-video-edit");
    expect(router.currentRoute.value.params.id).toBe("tagged-zenit.mp4");
  });

  it("shows only untagged videos", async () => {
    vi.stubGlobal("fetch", createCatalogFetchMock());

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await wrapper.get('[data-testid="filter-untagged"]').trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("20260801_new.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");
    expect(wrapper.text()).not.toContain("20260715.mp4");
  });

  it("clears selected tags when switching to Untagged and shows the untagged catalog", async () => {
    const zenitVideo = catalogVideos.find((video) => video.id === "tagged-zenit.mp4")!;
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=zenit") {
        return [zenitVideo];
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await wrapper.get('button[aria-label="Add zenit to search"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.get(".selected-tags").text()).toContain("zenit");

    await wrapper.get('[data-testid="filter-untagged"]').trigger("click");
    await nextTick();

    expect(wrapper.findAll(".selected-tags .tag-chip")).toHaveLength(0);
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("20260801_new.mp4");
    expect(wrapper.text()).not.toContain("20260715.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");

    await wrapper.get('[data-testid="filter-all"]').trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("4 results");
    expect(wrapper.text()).toContain("20260801_new.mp4");
    expect(wrapper.text()).toContain("20260715.mp4");
  });

  it("adds a clicked result tag to search without editing the video", async () => {
    const zenitVideo = catalogVideos.find((video) => video.id === "tagged-zenit.mp4")!;
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=zenit") {
        return [zenitVideo];
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    const zenitTag = wrapper.get('button[aria-label="Add zenit to search"]');
    expect(zenitTag.element.tagName).toBe("BUTTON");

    await zenitTag.trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=zenit");
    expect(wrapper.findAll(".selected-tags .tag-chip")).toHaveLength(1);
    expect(wrapper.get(".selected-tags").text()).toContain("zenit");
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("20260715.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");
    expect(router.currentRoute.value.name).toBe("home");
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PUT" || init?.method === "POST"),
    ).toBe(false);

    await wrapper.get('button[aria-label="Add zenit to search"]').trigger("click");
    await flushPromises();

    expect(wrapper.findAll(".selected-tags .tag-chip")).toHaveLength(1);
  });

  it("adds several result tags to search with AND", async () => {
    const salsaVideos = catalogVideos.filter((video) => video.tags.includes("salsa"));
    const salsaAndJota = catalogVideos.filter((video) => video.id === "salsa-jota.mp4");
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=salsa") {
        return salsaVideos;
      }

      if (url === "/api/search?tag=salsa&tag=jota") {
        return salsaAndJota;
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await wrapper.findAll('button[aria-label="Add salsa to search"]')[0]!.trigger("click");
    await flushPromises();
    await wrapper.get('button[aria-label="Add jota to search"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa");
    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa&tag=jota");
    expect(wrapper.findAll(".selected-tags .tag-chip")).toHaveLength(2);
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("first.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");
  });
});

describe("tag editor", () => {
  it("loads tags as chips, edits them locally, and keeps order", async () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa", "jota", "estela"],
        availableTags: ["salsa", "jota", "estela", "bufanda"],
      },
    });

    expect(wrapper.text()).toContain("salsa");
    expect(wrapper.text()).toContain("jota");
    expect(wrapper.text()).toContain("estela");

    await wrapper.get('button[aria-label="Remove jota"]').trigger("click");

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "estela"]);
  });

  it("keeps selected chips inside the compact tag input and marks new tags", () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa", "nuevo-tag"],
        availableTags: ["salsa", "bufanda"],
      },
    });

    const chips = wrapper.findAll(".tag-input-wrapper .tag-chip");
    expect(chips).toHaveLength(2);
    expect(chips[0]!.classes()).not.toContain("is-new");
    expect(chips[1]!.classes()).toContain("is-new");
    expect(chips[1]!.text()).toContain("nuevo-tag");
    expect(wrapper.find(".tag-combobox").exists()).toBe(true);
  });

  it("suggests existing tags and ignores duplicates", async () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa"],
        availableTags: ["salsa", "bufanda", "bachata"],
      },
    });

    const input = wrapper.get("#admin-tag-input");
    await input.setValue("bu");
    await input.trigger("focus");
    await nextTick();

    expect(wrapper.find(".tag-suggestions").text()).toContain("bufanda");
    expect(wrapper.find(".tag-suggestions").text()).not.toContain("salsa");

    await wrapper.findAll(".tag-suggestions button")[0]!.trigger("click");
    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "bufanda"]);

    await wrapper.setProps({ tags: ["salsa", "bufanda"] } as never);
    await input.setValue("bufanda");
    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "bufanda"]);
  });

  it("adds a brand-new tag with Enter", async () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa"],
        availableTags: ["salsa"],
      },
    });

    const input = wrapper.get("#admin-tag-input");
    await input.setValue("nuevo-tag");
    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "nuevo-tag"]);
  });

  it("keeps the suggestion list open after adding a tag while the input stays focused", async () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa"],
        availableTags: ["salsa", "bufanda"],
      },
    });

    const input = wrapper.get("#admin-tag-input");
    await input.setValue("estela");
    await input.trigger("focus");
    await nextTick();

    await wrapper.get('[data-testid="add-new-tag"]').trigger("click");
    await wrapper.setProps({ tags: ["salsa", "estela"] } as never);
    await nextTick();

    expect(wrapper.find(".tag-suggestions").exists()).toBe(true);
    expect(wrapper.find(".tag-suggestions").text()).toContain("bufanda");
  });

  it("offers to add a new tag instead of showing no matches", async () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa"],
        availableTags: ["salsa", "bufanda"],
      },
    });

    const input = wrapper.get("#admin-tag-input");
    await input.setValue("estela");
    await input.trigger("focus");
    await nextTick();

    expect(wrapper.text()).toContain("Add new tag");
    expect(wrapper.text()).not.toContain("No matching tags");

    await wrapper.get('[data-testid="add-new-tag"]').trigger("click");

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "estela"]);
  });

  it("lets the keyboard highlight a matching tag and add it with Enter", async () => {
    const wrapper = mount(TagEditor, {
      props: {
        tags: ["salsa"],
        availableTags: ["salsa", "bufanda", "bachata"],
      },
    });

    const input = wrapper.get("#admin-tag-input");
    await input.setValue("ba");
    await input.trigger("focus");
    await nextTick();

    await input.trigger("keydown", { key: "ArrowDown" });
    await nextTick();

    expect(wrapper.get(".tag-suggestions button.highlighted").text()).toBe("bachata");

    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "bachata"]);
  });
});

describe("tag search", () => {
  it("lets the keyboard highlight a matching tag and add it with Enter", async () => {
    const wrapper = mount(TagSearch, {
      props: {
        availableTags: ["salsa", "bufanda", "bachata"],
        selectedTags: [],
      },
    });

    const input = wrapper.get("#tag-input");
    await input.setValue("ba");
    await input.trigger("focus");
    await nextTick();
    await input.trigger("keydown", { key: "ArrowDown" });
    await nextTick();

    expect(wrapper.get(".tag-suggestions button.highlighted").text()).toBe("bachata");

    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("add-tag")?.at(-1)?.[0]).toBe("bachata");
  });

  it("selects the first matching tag with Enter when nothing is highlighted", async () => {
    const wrapper = mount(TagSearch, {
      props: {
        availableTags: ["salsa", "bufanda", "bachata"],
        selectedTags: [],
      },
    });

    const input = wrapper.get("#tag-input");
    await input.setValue("bu");
    await input.trigger("focus");
    await nextTick();
    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("add-tag")?.at(-1)?.[0]).toBe("bufanda");
  });

  it("shows No matching tags instead of creating a new search tag", async () => {
    const wrapper = mount(TagSearch, {
      props: {
        availableTags: ["salsa"],
        selectedTags: [],
      },
    });

    const input = wrapper.get("#tag-input");
    await input.setValue("nuevo-tag");
    await input.trigger("focus");
    await nextTick();

    expect(wrapper.text()).toContain("No matching tags");
    expect(wrapper.text()).not.toContain("Add new tag");

    await input.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("add-tag")).toBeUndefined();
  });

  it("shows selected search chips inside the tag input", async () => {
    const wrapper = mount(TagSearch, {
      props: {
        availableTags: ["salsa", "bufanda", "bachata"],
        selectedTags: ["salsa"],
      },
    });

    expect(wrapper.find(".tag-input-wrapper .tag-chip").text()).toContain("salsa");
    expect(wrapper.find(".tag-combobox").exists()).toBe(true);
    expect(wrapper.find(".tag-search .primary-button").exists()).toBe(false);
    expect(wrapper.text()).toContain("Clear tags");
  });
});

describe("admin video editor", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads current tags and saves the final list with PUT", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: 2, results: videos });
      }

      if (url === "/api/videos/salsa/first.mp4/tags" && init?.method === "PUT") {
        return jsonResponse({ tags: ["salsa", "bufanda"] });
      }

      if (url === "/api/videos/salsa/first.mp4/tags") {
        return jsonResponse({ tags: ["salsa", "isa"] });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/videos/salsa/first.mp4");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideoEditView, router, { id: "salsa/first.mp4" });
    await flushPromises();

    expect(wrapper.text()).toContain("first.mp4");
    expect(wrapper.get("h1").text()).toBe("Edit video");
    expect(wrapper.text()).toContain('Edit tags for "first.mp4"');
    expect(wrapper.find("#admin-tag-input").exists()).toBe(true);
    expect(wrapper.get('[data-testid="nav-view"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="upload-new-video"]').classes()).not.toContain("active");

    await wrapper.get('button[aria-label="Remove isa"]').trigger("click");
    await wrapper.get("#admin-tag-input").setValue("bufanda");
    await wrapper.get("#admin-tag-input").trigger("keydown", { key: "Enter" });
    await wrapper.get('[data-testid="save-tags"]').trigger("click");
    await flushPromises();

    const putCall = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(putCall?.[0]).toBe("/api/videos/salsa/first.mp4/tags");
    expect(putCall?.[1]).toMatchObject({
      method: "PUT",
      body: JSON.stringify({ tags: ["salsa", "bufanda"] }),
    });
    expect(wrapper.text()).toContain("Tags saved.");
  });

  it("keeps local changes and shows an error when PUT fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: 2, results: videos });
      }

      if (url === "/api/videos/untagged.mp4/tags" && init?.method === "PUT") {
        return jsonResponse({ error: { message: "Unable to save tags." } }, false, 500);
      }

      if (url === "/api/videos/untagged.mp4/tags") {
        return jsonResponse({ tags: [] });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/videos/untagged.mp4");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideoEditView, router, { id: "untagged.mp4" });
    await flushPromises();

    await wrapper.get("#admin-tag-input").setValue("salsa");
    await wrapper.get("#admin-tag-input").trigger("keydown", { key: "Enter" });
    await wrapper.get('[data-testid="save-tags"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Unable to save tags.");
    expect(wrapper.find("#admin-tag-input").exists()).toBe(true);
    expect(wrapper.text()).toContain("salsa");
  });

  it("asks for confirmation before deleting a video and reloads the catalog after success", async () => {
    const remainingVideos = videos.filter((video) => video.id !== "salsa/first.mp4");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/videos/salsa/first.mp4" && init?.method === "DELETE") {
        return jsonResponse({ id: "salsa/first.mp4" });
      }

      if (url === "/api/search") {
        return jsonResponse({
          query: { tags: [] },
          count: remainingVideos.length,
          results: remainingVideos,
        });
      }

      if (url === "/api/videos/salsa/first.mp4/tags") {
        return jsonResponse({ tags: ["salsa", "isa"] });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/videos/salsa/first.mp4");
    await router.isReady();
    const wrapper = mount(Root, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();
    expect(wrapper.get('[data-testid="delete-video"]').text()).toBe("Delete video");
    expect(wrapper.find(".admin-video-confirm-modal").exists()).toBe(false);

    await wrapper.get('[data-testid="delete-video"]').trigger("click");
    await nextTick();

    expect(wrapper.find(".admin-video-confirm-modal").exists()).toBe(true);
    expect(wrapper.text()).toContain("Delete video?");
    expect(wrapper.text()).toContain(
      "This will delete the video and its thumbnail from the library, and all of its tag relations. This cannot be undone.",
    );

    await wrapper.get('[data-testid="cancel-delete-video"]').trigger("click");
    await nextTick();

    expect(wrapper.find(".admin-video-confirm-modal").exists()).toBe(false);
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
    expect(router.currentRoute.value.name).toBe("admin-video-edit");

    await wrapper.get('[data-testid="delete-video"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-video"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/videos/salsa/first.mp4", { method: "DELETE" });
    expect(router.currentRoute.value.name).toBe("home");
    expect(fetchMock).toHaveBeenCalledWith("/api/search");
    expect(wrapper.text()).toContain("Untagged (1)");
    expect(wrapper.text()).not.toContain("first.mp4");
  });

  it("avoids a second DELETE while a deletion is in progress", async () => {
    let resolveDelete: (() => void) | undefined;
    const deleteGate = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/videos/salsa/first.mp4" && init?.method === "DELETE") {
        await deleteGate;
        return jsonResponse({ id: "salsa/first.mp4" });
      }

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: 2, results: videos });
      }

      if (url === "/api/videos/salsa/first.mp4/tags") {
        return jsonResponse({ tags: ["salsa", "isa"] });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/videos/salsa/first.mp4");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideoEditView, router, { id: "salsa/first.mp4" });
    await flushPromises();

    await wrapper.get('[data-testid="delete-video"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-video"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-video"]').trigger("click");
    await nextTick();

    expect(wrapper.get('[data-testid="confirm-delete-video"]').text()).toBe("Deleting...");
    expect(
      fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE"),
    ).toHaveLength(1);

    resolveDelete?.();
    await flushPromises();
  });

  it("shows a delete error without leaving the editor", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/videos/salsa/first.mp4" && init?.method === "DELETE") {
        return jsonResponse({ error: { message: "Unable to delete video." } }, false, 500);
      }

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: 2, results: videos });
      }

      if (url === "/api/videos/salsa/first.mp4/tags") {
        return jsonResponse({ tags: ["salsa", "isa"] });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/videos/salsa/first.mp4");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideoEditView, router, { id: "salsa/first.mp4" });
    await flushPromises();

    await wrapper.get('[data-testid="delete-video"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-video"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Unable to delete video.");
    expect(router.currentRoute.value.name).toBe("admin-video-edit");
    expect(wrapper.find("#admin-tag-input").exists()).toBe(true);
    expect(wrapper.text()).toContain("salsa");
  });

  it("returns to the catalog when the video is already gone", async () => {
    const remainingVideos = videos.filter((video) => video.id !== "salsa/first.mp4");
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/videos/salsa/first.mp4" && init?.method === "DELETE") {
        return jsonResponse({ error: { message: "Video not found" } }, false, 404);
      }

      if (url === "/api/search") {
        return jsonResponse({
          query: { tags: [] },
          count: remainingVideos.length,
          results: remainingVideos,
        });
      }

      if (url === "/api/videos/salsa/first.mp4/tags") {
        return jsonResponse({ tags: ["salsa", "isa"] });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/videos/salsa/first.mp4");
    await router.isReady();
    const wrapper = mount(Root, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="delete-video"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-video"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("home");
    expect(wrapper.text()).toContain("Untagged (1)");
    expect(wrapper.text()).not.toContain("first.mp4");
  });
});

describe("admin untagged flow", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes a video from Untagged after a tag is saved", async () => {
    let untaggedTags: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/search") {
        const results = videos.map((video) =>
          video.id === "untagged.mp4" ? { ...video, tags: untaggedTags } : video,
        );
        return jsonResponse({ query: { tags: [] }, count: results.length, results });
      }

      if (url === "/api/videos/untagged.mp4/tags" && init?.method === "PUT") {
        untaggedTags = ["salsa"];
        return jsonResponse({ tags: ["salsa"] });
      }

      if (url === "/api/videos/untagged.mp4/tags") {
        return jsonResponse({ tags: untaggedTags });
      }

      const adminResponse = adminEditorResponse(url);
      if (adminResponse !== null) {
        return adminResponse;
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(Root, {
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="filter-untagged"]').trigger("click");
    await nextTick();
    expect(wrapper.text()).toContain("20260801_new.mp4");

    await wrapper.get('a[aria-label="Edit tags for 20260801_new.mp4"]').trigger("click");
    await flushPromises();

    await wrapper.get("#admin-tag-input").setValue("salsa");
    await wrapper.get("#admin-tag-input").trigger("keydown", { key: "Enter" });
    await wrapper.get('[data-testid="save-tags"]').trigger("click");
    await flushPromises();

    await router.push("/");
    await flushPromises();

    await wrapper.get('[data-testid="filter-untagged"]').trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("Untagged (0)");
    expect(wrapper.text()).not.toContain("20260801_new.mp4");
  });
});

describe("consumer search view", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows every video on the first load", async () => {
    const fetchMock = createCatalogFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter("/");
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/search");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
    expect(wrapper.find(".search-results").exists()).toBe(true);
    expect(wrapper.text()).toContain("4 results");
    expect(wrapper.text()).toContain("Find a video, play it, or edit its tags.");
    expect(wrapper.find('button[aria-label="Refresh library"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="nav-view"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="upload-new-video"]').classes()).not.toContain("active");
  });

  it("shows the full catalog again when every tag is cleared", async () => {
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=salsa") {
        return catalogVideos.filter((video) => video.tags.includes("salsa"));
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter("/");
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["salsa"]);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa");
    expect(wrapper.text()).toContain("2 results");

    const clearButton = wrapper.findAll("button").find((button) => button.text() === "Clear tags");
    expect(clearButton).toBeDefined();
    await clearButton!.trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("4 results");
    expect(wrapper.find(".selected-tags").exists()).toBe(false);
  });

  it("shows the full catalog when the last selected tag is removed", async () => {
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=salsa") {
        return catalogVideos.filter((video) => video.tags.includes("salsa"));
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter("/");
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["salsa"]);
    await flushPromises();
    expect(wrapper.text()).toContain("2 results");

    await wrapper.get('button[aria-label="Remove salsa"]').trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("4 results");
    expect(wrapper.find(".selected-tags").exists()).toBe(false);
  });

  it("searches as soon as a result tag is added", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/tags") {
        return jsonResponse({ count: catalogTags.length, tags: tagItems(...catalogTags) });
      }

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: catalogVideos.length, results: catalogVideos });
      }

      if (url === "/api/search?tag=salsa") {
        return jsonResponse({
          query: { tags: ["salsa"] },
          count: 1,
          results: catalogVideos.filter((video) => video.id === "salsa-jota.mp4"),
        });
      }

      if (url === "/api/search?tag=salsa&tag=jota") {
        return jsonResponse({
          query: { tags: ["salsa", "jota"] },
          count: 1,
          results: catalogVideos.filter((video) => video.id === "salsa-jota.mp4"),
        });
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter("/");
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["salsa"]);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa");
    expect(wrapper.find(".tag-search .primary-button").exists()).toBe(false);

    await wrapper.get('button[aria-label="Add jota to search"]').trigger("click");
    await flushPromises();

    expect(wrapper.get(".selected-tags").text()).toContain("salsa");
    expect(wrapper.get(".selected-tags").text()).toContain("jota");
    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa&tag=jota");
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PUT" || init?.method === "POST"),
    ).toBe(false);
  });
});

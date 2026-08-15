import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter, type Router } from "vue-router";

import type { SearchResultItem } from "../src/api/types.js";
import TagEditor from "../src/components/TagEditor.vue";
import TagSearch from "../src/components/TagSearch.vue";
import AdminVideoEditView from "../src/views/AdminVideoEditView.vue";
import AdminVideosView from "../src/views/AdminVideosView.vue";
import HomeView from "../src/views/HomeView.vue";

const videos: SearchResultItem[] = [
  {
    id: "untagged.mp4",
    name: "20260801_new.mp4",
    thumbnail: "/api/thumbnail/untagged.mp4",
    video: "/api/video/untagged.mp4",
    tags: [],
  },
  {
    id: "salsa/first.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa/first.mp4",
    video: "/api/video/salsa/first.mp4",
    tags: ["salsa", "isa"],
  },
];

const catalogVideos: SearchResultItem[] = [
  {
    id: "untagged.mp4",
    name: "20260801_new.mp4",
    thumbnail: "/api/thumbnail/untagged.mp4",
    video: "/api/video/untagged.mp4",
    tags: [],
  },
  {
    id: "name-only-zenit.mp4",
    name: "zenit-practice.mp4",
    thumbnail: "/api/thumbnail/name-only-zenit.mp4",
    video: "/api/video/name-only-zenit.mp4",
    tags: ["salsa"],
  },
  {
    id: "tagged-zenit.mp4",
    name: "20260715.mp4",
    thumbnail: "/api/thumbnail/tagged-zenit.mp4",
    video: "/api/video/tagged-zenit.mp4",
    tags: ["zenit"],
  },
  {
    id: "salsa-jota.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa-jota.mp4",
    video: "/api/video/salsa-jota.mp4",
    tags: ["salsa", "jota"],
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

function createCatalogFetchMock(
  searchHandler: (url: string) => SearchResultItem[] | null = () => null,
) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/tags") {
      return jsonResponse({ count: catalogTags.length, tags: catalogTags });
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
  }
}

function createTestRouter(initialPath = "/admin/videos"): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: HomeView },
      { path: "/admin/videos", name: "admin-videos", component: AdminVideosView },
      {
        path: "/admin/videos/:id(.*)",
        name: "admin-video-edit",
        component: AdminVideoEditView,
        props: true,
      },
    ],
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
    await router.push("/admin/videos");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
    expect(wrapper.text()).toContain("4 results");
    expect(wrapper.text()).toContain("Sin tags (1)");
    expect(wrapper.text()).toContain("20260801_new.mp4");
    expect(wrapper.text()).toContain("zenit-practice.mp4");
    expect(wrapper.text()).toContain("20260715.mp4");
    expect(wrapper.text()).toContain("first.mp4");
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
    await router.push("/admin/videos");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["zenit"]);
    await wrapper.get(".primary-button").trigger("click");
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
    await router.push("/admin/videos");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["salsa", "jota"]);
    await wrapper.get(".primary-button").trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=salsa&tag=jota");
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("first.mp4");
    expect(wrapper.text()).not.toContain("zenit-practice.mp4");
  });

  it("opens the tag editor for a search result", async () => {
    const zenitVideo = catalogVideos.find((video) => video.id === "tagged-zenit.mp4")!;
    vi.stubGlobal(
      "fetch",
      createCatalogFetchMock((url) => (url === "/api/search?tag=zenit" ? [zenitVideo] : null)),
    );

    const router = createTestRouter();
    await router.push("/admin/videos");
    await router.isReady();
    const wrapper = mountWithRouter(AdminVideosView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["zenit"]);
    await wrapper.get(".primary-button").trigger("click");
    await flushPromises();
    await wrapper.get('button[aria-label="Play video tagged zenit"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-video-edit");
    expect(router.currentRoute.value.params.id).toBe("tagged-zenit.mp4");
  });

  it("shows only untagged videos", async () => {
    vi.stubGlobal("fetch", createCatalogFetchMock());

    const router = createTestRouter();
    await router.push("/admin/videos");
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

  it("clears selected tags when switching to Sin tags and shows the untagged catalog", async () => {
    const zenitVideo = catalogVideos.find((video) => video.id === "tagged-zenit.mp4")!;
    const fetchMock = createCatalogFetchMock((url) => {
      if (url === "/api/search?tag=zenit") {
        return [zenitVideo];
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/videos");
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
    await router.push("/admin/videos");
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
    expect(router.currentRoute.value.name).toBe("admin-videos");
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
    await router.push("/admin/videos");
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
    await input.trigger("keydown.enter");

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
    await input.trigger("keydown.enter");

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "nuevo-tag"]);
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

    expect(wrapper.text()).toContain("Añadir nuevo tag");
    expect(wrapper.text()).not.toContain("No matching tags");

    await wrapper.get('[data-testid="add-new-tag"]').trigger("click");

    expect(wrapper.emitted("update:tags")?.at(-1)?.[0]).toEqual(["salsa", "estela"]);
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

      if (url === "/api/tags") {
        return jsonResponse({ count: 3, tags: ["bufanda", "isa", "salsa"] });
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
    expect(wrapper.find("#admin-tag-input").exists()).toBe(true);

    await wrapper.get('button[aria-label="Remove isa"]').trigger("click");
    await wrapper.get("#admin-tag-input").setValue("bufanda");
    await wrapper.get("#admin-tag-input").trigger("keydown.enter");
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

      if (url === "/api/tags") {
        return jsonResponse({ count: 1, tags: ["salsa"] });
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
    await wrapper.get("#admin-tag-input").trigger("keydown.enter");
    await wrapper.get('[data-testid="save-tags"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Unable to save tags.");
    expect(wrapper.find("#admin-tag-input").exists()).toBe(true);
    expect(wrapper.text()).toContain("salsa");
  });
});

describe("admin untagged flow", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("removes a video from Sin tags after a tag is saved", async () => {
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

      if (url === "/api/tags") {
        return jsonResponse({ count: 1, tags: ["salsa"] });
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/videos");
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

    await wrapper.get('button[aria-label="Play video tagged "]').trigger("click");
    await flushPromises();

    await wrapper.get("#admin-tag-input").setValue("salsa");
    await wrapper.get("#admin-tag-input").trigger("keydown.enter");
    await wrapper.get('[data-testid="save-tags"]').trigger("click");
    await flushPromises();

    await router.push("/admin/videos");
    await flushPromises();

    await wrapper.get('[data-testid="filter-untagged"]').trigger("click");
    await nextTick();

    expect(wrapper.text()).toContain("Sin tags (0)");
    expect(wrapper.text()).not.toContain("20260801_new.mp4");
  });
});

describe("consumer search view", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("still loads the existing tag search screen", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 1, tags: ["salsa"] }));
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter("/");
    await router.push("/");
    await router.isReady();
    const wrapper = mountWithRouter(HomeView, router);
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/search");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
    expect(wrapper.find(".search-results").exists()).toBe(false);
    expect(wrapper.text()).toContain("Search your tagged videos and watch them from any browser.");
  });

  it("still adds a clicked result tag to search without running a new query until Search", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/tags") {
        return jsonResponse({ count: catalogTags.length, tags: catalogTags });
      }

      if (url === "/api/search?tag=salsa") {
        return jsonResponse({
          query: { tags: ["salsa"] },
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
    const wrapper = mountWithRouter(HomeView, router);
    await flushPromises();

    await addSearchTags(wrapper, ["salsa"]);
    await wrapper.get(".primary-button").trigger("click");
    await flushPromises();

    await wrapper.get('button[aria-label="Add jota to search"]').trigger("click");
    await nextTick();

    expect(wrapper.get(".selected-tags").text()).toContain("salsa");
    expect(wrapper.get(".selected-tags").text()).toContain("jota");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/search?tag=salsa&tag=jota");
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "PUT" || init?.method === "POST"),
    ).toBe(false);
  });
});

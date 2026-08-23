import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import AdminTagsView from "../src/views/AdminTagsView.vue";
import { routes } from "../src/router.js";
import { catalogTag, seedTagTypes, tagItems } from "./tag-fixtures.js";

const catalog = {
  count: 3,
  tags: [
    catalogTag({
      id: 1,
      name: "estela",
      usageCount: 63,
      typeId: 3,
      typeName: "teacher",
      color: "#27ae60",
      typeSortOrder: 3,
    }),
    catalogTag({
      id: 2,
      name: "jota",
      usageCount: 84,
      typeId: 3,
      typeName: "teacher",
      color: "#27ae60",
      typeSortOrder: 3,
    }),
    catalogTag({
      id: 3,
      name: "salsa",
      usageCount: 127,
      typeId: 1,
      typeName: "type",
      color: "#c0392b",
      typeSortOrder: 1,
    }),
  ],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function adminTagsFetch(
  extra?: (url: string, init?: RequestInit) => Response | null,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url === "/api/admin/tag-types") {
      return jsonResponse(seedTagTypes);
    }

    const extraResponse = extra?.(url, init);
    if (extraResponse !== null && extraResponse !== undefined) {
      return extraResponse;
    }

    if (url === "/api/admin/tags") {
      return jsonResponse(catalog);
    }

    if (url === "/api/tags") {
      return jsonResponse({ count: 3, tags: tagItems("estela", "jota", "salsa") });
    }

    if (url === "/api/search") {
      return jsonResponse({ query: { tags: [] }, count: 0, results: [] });
    }

    return jsonResponse({ error: { message: "Not found" } }, false, 404);
  });
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe("admin tag catalog", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists tags with usage counts", async () => {
    vi.stubGlobal("fetch", adminTagsFetch());

    const router = createTestRouter();
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(AdminTagsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("estela (63)");
    expect(wrapper.text()).toContain("jota (84)");
    expect(wrapper.text()).toContain("salsa (127)");
    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "estela",
      "jota",
      "salsa",
    ]);
    expect(wrapper.findAll(".admin-tag-count").map((count) => count.text())).toEqual([
      "(63)",
      "(84)",
      "(127)",
    ]);
    expect(wrapper.get('a[aria-label="View videos tagged jota"]').attributes("href")).toBe(
      "/?tag=jota",
    );
  });

  it("opens an edit modal, can cancel, and saves name and type", async () => {
    const fetchMock = adminTagsFetch((url, init) => {
      if (url === "/api/admin/tags/2" && init?.method === "PUT") {
        return jsonResponse({
          ...catalog.tags[1],
          name: "jota-nueva",
        });
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(AdminTagsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    const jota = wrapper.findAll(".admin-tag-item").find((item) => item.text().includes("jota (84)"))!;
    await jota.get('button[aria-label="Edit jota"]').trigger("click");
    await nextTick();

    expect(wrapper.find("#edit-tag-name").exists()).toBe(true);

    await wrapper.get("#edit-tag-name").setValue("jota-nueva");
    await wrapper.get(".admin-tag-confirm-modal .secondary-button").trigger("click");
    await nextTick();

    expect(wrapper.find("#edit-tag-name").exists()).toBe(false);
    expect(wrapper.text()).toContain("jota (84)");

    const jotaAgain = wrapper.findAll(".admin-tag-item").find((item) => item.text().includes("jota (84)"))!;
    await jotaAgain.get('button[aria-label="Edit jota"]').trigger("click");
    await wrapper.get("#edit-tag-name").setValue("jota-nueva");
    await wrapper.get('[data-testid="save-tag"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tags/2", {
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ name: "jota-nueva", typeId: 3 }),
    });
    expect(wrapper.text()).toContain("jota-nueva (84)");
    expect(wrapper.text()).not.toContain("jota (84)");
  });

  it("shows a rename error and keeps the tag editable", async () => {
    const fetchMock = adminTagsFetch((url, init) => {
      if (url === "/api/admin/tags/2" && init?.method === "PUT") {
        return jsonResponse({ error: { message: "Tag name already exists: salsa" } }, false, 409);
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(AdminTagsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    const jota = wrapper.findAll(".admin-tag-item").find((item) => item.text().includes("jota (84)"))!;
    await jota.get('button[aria-label="Edit jota"]').trigger("click");
    await wrapper.get("#edit-tag-name").setValue("salsa");
    await wrapper.get('[data-testid="save-tag"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Tag name already exists: salsa");
    expect(wrapper.find("#edit-tag-name").exists()).toBe(true);
    expect((wrapper.get("#edit-tag-name").element as HTMLInputElement).value).toBe("salsa");
    expect(wrapper.findAll(".admin-tag-item")).toHaveLength(3);
  });

  it("asks for confirmation before deleting a tag and then removes it", async () => {
    const fetchMock = adminTagsFetch((url, init) => {
      if (url === "/api/admin/tags/2" && init?.method === "DELETE") {
        return jsonResponse({ id: 2 });
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(AdminTagsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    const jota = wrapper.findAll(".admin-tag-item").find((item) => item.text().includes("jota (84)"))!;
    await jota.get('button[aria-label="Delete jota"]').trigger("click");
    await nextTick();

    expect(wrapper.find(".admin-tag-confirm-modal").exists()).toBe(true);
    expect(jota.find(".admin-tag-confirm-modal").exists()).toBe(false);
    expect(wrapper.text()).toContain('Delete the tag "jota"?');
    expect(wrapper.text()).toContain("This will also remove it from every video that uses it.");

    await wrapper.get('[data-testid="cancel-delete-tag"]').trigger("click");
    await nextTick();
    expect(wrapper.text()).not.toContain('Delete the tag "jota"?');
    expect(wrapper.text()).toContain("jota (84)");

    const jotaAgain = wrapper.findAll(".admin-tag-item").find((item) => item.text().includes("jota (84)"))!;
    await jotaAgain.get('button[aria-label="Delete jota"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-tag"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tags/2", { method: "DELETE" });
    expect(wrapper.text()).not.toContain("jota (84)");
    expect(wrapper.text()).toContain("salsa (127)");
  });

  it("filters the catalog as the search query is typed", async () => {
    vi.stubGlobal("fetch", adminTagsFetch());

    const router = createTestRouter();
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(AdminTagsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.findAll(".admin-tag-item")).toHaveLength(3);

    await wrapper.get("#catalog-tag-filter").setValue("jo");
    await nextTick();

    expect(wrapper.text()).toContain("jota (84)");
    expect(wrapper.text()).not.toContain("salsa (127)");
    expect(wrapper.text()).not.toContain("estela (63)");
    expect(wrapper.findAll(".admin-tag-item")).toHaveLength(1);

    await wrapper.get("#catalog-tag-filter").setValue("xyz");
    await nextTick();

    expect(wrapper.text()).toContain("No matching tags.");
    expect(wrapper.find(".admin-tag-catalog").exists()).toBe(false);
  });

  it("sorts tags alphabetically, by usage, and by type", async () => {
    const fetchMock = adminTagsFetch((url) => {
      if (url === "/api/admin/tags") {
        return jsonResponse({
          count: 3,
          tags: [
            catalogTag({
              id: 1,
              name: "estela",
              usageCount: 63,
              typeId: 3,
              typeName: "teacher",
              color: "#27ae60",
              typeSortOrder: 3,
            }),
            catalogTag({
              id: 2,
              name: "jota",
              usageCount: 84,
              typeId: 3,
              typeName: "teacher",
              color: "#27ae60",
              typeSortOrder: 3,
            }),
            catalogTag({
              id: 3,
              name: "salsa",
              usageCount: 10,
              typeId: 1,
              typeName: "type",
              color: "#c0392b",
              typeSortOrder: 1,
            }),
          ],
        });
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(AdminTagsView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "estela",
      "jota",
      "salsa",
    ]);
    expect(wrapper.get('[data-testid="sort-name"]').text()).toContain("↓");

    await wrapper.get('[data-testid="sort-name"]').trigger("click");
    await nextTick();
    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "salsa",
      "jota",
      "estela",
    ]);
    expect(wrapper.get('[data-testid="sort-name"]').text()).toContain("↑");

    await wrapper.get('[data-testid="sort-usage"]').trigger("click");
    await nextTick();
    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "jota",
      "estela",
      "salsa",
    ]);
    expect(wrapper.get('[data-testid="sort-usage"]').text()).toContain("↓");

    await wrapper.get('[data-testid="sort-usage"]').trigger("click");
    await nextTick();
    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "salsa",
      "estela",
      "jota",
    ]);
    expect(wrapper.get('[data-testid="sort-usage"]').text()).toContain("↑");

    await wrapper.get('[data-testid="sort-name"]').trigger("click");
    await nextTick();
    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "estela",
      "jota",
      "salsa",
    ]);
    expect(wrapper.get('[data-testid="sort-name"]').text()).toContain("↓");

    await wrapper.get('[data-testid="sort-type"]').trigger("click");
    await nextTick();
    expect(wrapper.findAll(".admin-tag-name").map((name) => name.text())).toEqual([
      "salsa",
      "estela",
      "jota",
    ]);
    expect(wrapper.get('[data-testid="sort-type"]').text()).toContain("↓");
  });

  it("links from the library home to the admin pages", async () => {
    vi.stubGlobal("fetch", adminTagsFetch());

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('button[aria-label="Refresh library"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="nav-view"]').classes()).toContain("active");

    await wrapper.get("a[href='/admin/tags']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("admin-tags");
    expect(wrapper.get('[data-testid="nav-tags"]').classes()).toContain("active");
    expect(wrapper.text()).toContain("salsa (127)");

    await wrapper.get("a[href='/']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("home");
    expect(wrapper.get('[data-testid="nav-view"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="upload-new-video"]').classes()).not.toContain("active");
  });

  it("navigates between the video and tag admin pages", async () => {
    vi.stubGlobal("fetch", adminTagsFetch());

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Media Library");

    await wrapper.get("a[href='/admin/tags']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-tags");
    expect(wrapper.text()).toContain("Tag catalog");
    expect(wrapper.text()).toContain("salsa (127)");

    await wrapper.get("a[href='/']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("home");
    expect(wrapper.text()).toContain("Media Library");
  });

  it("opens the admin video search with the selected tag", async () => {
    const fetchMock = adminTagsFetch((url) => {
      if (url === "/api/videos/jota.mp4/tags") {
        return jsonResponse({ tags: ["jota"] });
      }

      if (url === "/api/search?tag=jota") {
        return jsonResponse({
          query: { tags: ["jota"] },
          count: 1,
          results: [
            {
              id: "jota.mp4",
              name: "jota.mp4",
              thumbnail: "/api/thumbnail/jota.mp4",
              video: "/api/video/jota.mp4",
              tags: ["jota"],
              recordedAt: null,
            },
          ],
        });
      }

      if (url === "/api/search") {
        return jsonResponse({
          query: { tags: [] },
          count: 1,
          results: [
            {
              id: "jota.mp4",
              name: "jota.mp4",
              thumbnail: "/api/thumbnail/jota.mp4",
              video: "/api/video/jota.mp4",
              tags: ["jota"],
              recordedAt: null,
            },
          ],
        });
      }

      return null;
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/tags");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();

    await wrapper.get('a[aria-label="View videos tagged jota"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("home");
    expect(router.currentRoute.value.query).toEqual({ tag: "jota" });
    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=jota");
    expect(wrapper.get(".selected-tags").text()).toContain("jota");
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.find('a[aria-label="Edit tags for jota.mp4"]').exists()).toBe(true);
    expect(wrapper.get('a[aria-label="Edit tags for jota.mp4"]').text()).toBe("Edit video");

    await wrapper.get('a[aria-label="Edit tags for jota.mp4"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-video-edit");
    expect(router.currentRoute.value.params).toEqual({ id: "jota.mp4" });
    expect(wrapper.get("h1").text()).toBe("Edit video");
    expect(wrapper.text()).toContain('Edit tags for "jota.mp4"');
  });
});

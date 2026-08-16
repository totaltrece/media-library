import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import AdminTagsView from "../src/views/AdminTagsView.vue";
import AdminVideoEditView from "../src/views/AdminVideoEditView.vue";
import AdminVideoUploadView from "../src/views/AdminVideoUploadView.vue";
import AdminVideosView from "../src/views/AdminVideosView.vue";
import HomeView from "../src/views/HomeView.vue";

const catalog = {
  count: 3,
  tags: [
    { id: 1, name: "estela", usageCount: 63 },
    { id: 2, name: "jota", usageCount: 84 },
    { id: 3, name: "salsa", usageCount: 127 },
  ],
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "home", component: HomeView },
      { path: "/admin/videos", name: "admin-videos", component: AdminVideosView },
      { path: "/admin/videos/upload", name: "admin-video-upload", component: AdminVideoUploadView },
      { path: "/admin/tags", name: "admin-tags", component: AdminTagsView },
      {
        path: "/admin/videos/:id(.*)",
        name: "admin-video-edit",
        component: AdminVideoEditView,
        props: true,
      },
    ],
  });
}

describe("admin tag catalog", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists tags with usage counts", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(catalog)));

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
      "/admin/videos?tag=jota",
    );
  });

  it("enters edit mode, can cancel, and saves a rename", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/tags" && init?.method === "PUT") {
        return jsonResponse({ error: { message: "unexpected" } }, false, 500);
      }

      if (url === "/api/admin/tags/2" && init?.method === "PUT") {
        return jsonResponse({ id: 2, name: "jota-nueva", usageCount: 84 });
      }

      if (url === "/api/admin/tags") {
        return jsonResponse(catalog);
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
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

    expect(wrapper.find("#rename-tag-2").exists()).toBe(true);

    await wrapper.get("#rename-tag-2").setValue("jota-nueva");
    await jota.findAll("button").find((button) => button.text() === "Cancel")!.trigger("click");
    await nextTick();

    expect(wrapper.find("#rename-tag-2").exists()).toBe(false);
    expect(wrapper.text()).toContain("jota (84)");

    const jotaAgain = wrapper.findAll(".admin-tag-item").find((item) => item.text().includes("jota (84)"))!;
    await jotaAgain.get('button[aria-label="Edit jota"]').trigger("click");
    await wrapper.get("#rename-tag-2").setValue("jota-nueva");
    await wrapper.get('[data-testid="save-tag"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tags/2", {
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ name: "jota-nueva" }),
    });
    expect(wrapper.text()).toContain("jota-nueva (84)");
    expect(wrapper.text()).not.toContain("jota (84)");
  });

  it("shows a rename error and keeps the tag editable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/tags/2" && init?.method === "PUT") {
        return jsonResponse({ error: { message: "Tag name already exists: salsa" } }, false, 409);
      }

      if (url === "/api/admin/tags") {
        return jsonResponse(catalog);
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
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
    await wrapper.get("#rename-tag-2").setValue("salsa");
    await wrapper.get('[data-testid="save-tag"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Tag name already exists: salsa");
    expect(wrapper.find("#rename-tag-2").exists()).toBe(true);
    expect((wrapper.get("#rename-tag-2").element as HTMLInputElement).value).toBe("salsa");
    expect(wrapper.findAll(".admin-tag-item")).toHaveLength(3);
  });

  it("asks for confirmation before deleting a tag and then removes it", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/tags/2" && init?.method === "DELETE") {
        return jsonResponse({ id: 2 });
      }

      if (url === "/api/admin/tags") {
        return jsonResponse(catalog);
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
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
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(catalog)));

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

  it("sorts tags alphabetically and by usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          count: 3,
          tags: [
            { id: 1, name: "estela", usageCount: 63 },
            { id: 2, name: "jota", usageCount: 84 },
            { id: 3, name: "salsa", usageCount: 10 },
          ],
        }),
      ),
    );

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
  });

  it("links from the library home to the admin pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/admin/tags") {
          return jsonResponse(catalog);
        }

        if (url === "/api/tags") {
          return jsonResponse({ count: 1, tags: ["salsa"] });
        }

        if (url === "/api/search") {
          return jsonResponse({ query: { tags: [] }, count: 0, results: [] });
        }

        return jsonResponse({ error: { message: "Not found" } }, false, 404);
      }),
    );

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

    await wrapper.get("a[href='/admin/videos']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("admin-videos");
    expect(wrapper.find('button[aria-label="Refresh library"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="nav-videos"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="upload-new-video"]').classes()).not.toContain("active");
    expect(wrapper.text()).not.toContain("Refresh library");

    await wrapper.get("a[href='/admin/tags']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("admin-tags");
    expect(wrapper.get('[data-testid="nav-tags"]').classes()).toContain("active");
    expect(wrapper.text()).toContain("salsa (127)");
  });

  it("navigates between the video and tag admin pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/admin/tags") {
          return jsonResponse(catalog);
        }

        if (url === "/api/tags") {
          return jsonResponse({ count: 1, tags: ["salsa"] });
        }

        if (url === "/api/search") {
          return jsonResponse({ query: { tags: [] }, count: 0, results: [] });
        }

        return jsonResponse({ error: { message: "Not found" } }, false, 404);
      }),
    );

    const router = createTestRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/videos");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Video tags");

    await wrapper.get("a[href='/admin/tags']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-tags");
    expect(wrapper.text()).toContain("Tag catalog");
    expect(wrapper.text()).toContain("salsa (127)");

    await wrapper.get("a[href='/admin/videos']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-videos");
    expect(wrapper.text()).toContain("Video tags");
  });

  it("opens the admin video search with the selected tag", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/tags") {
        return jsonResponse(catalog);
      }

      if (url === "/api/tags") {
        return jsonResponse({ count: 3, tags: ["estela", "jota", "salsa"] });
      }

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

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
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

    expect(router.currentRoute.value.name).toBe("admin-videos");
    expect(router.currentRoute.value.query).toEqual({ tag: "jota" });
    expect(fetchMock).toHaveBeenCalledWith("/api/search?tag=jota");
    expect(wrapper.get(".selected-tags").text()).toContain("jota");
    expect(wrapper.text()).toContain("1 result");
    expect(wrapper.text()).toContain("jota.mp4");

    await wrapper.get('button[aria-label="Play video tagged jota"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("admin-video-edit");
    expect(router.currentRoute.value.params).toEqual({ id: "jota.mp4" });
    expect(wrapper.get("h1").text()).toBe("Edit video");
    expect(wrapper.text()).toContain('Edit tags for "jota.mp4"');
  });
});

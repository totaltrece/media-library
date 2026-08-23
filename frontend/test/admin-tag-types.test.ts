import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import { routes } from "../src/router.js";
import AdminTagTypesView from "../src/views/AdminTagTypesView.vue";
import { seedTagTypes } from "./tag-fixtures.js";

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
    routes,
  });
}

describe("admin tag types", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists types and can add one", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/tag-types" && init?.method === "POST") {
        return jsonResponse({
          id: 6,
          name: "workshop",
          color: "#93c5fd",
          isDefault: false,
          sortOrder: 6,
          tagCount: 0,
        }, true, 201);
      }

      if (url === "/api/admin/tag-types") {
        return jsonResponse(seedTagTypes);
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/tag-types");
    await router.isReady();
    const wrapper = mount(AdminTagTypesView, {
      global: {
        plugins: [router],
        stubs: { ColorPickerField: true },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("teacher");
    expect(wrapper.text()).toContain("default");

    await wrapper.get("#new-tag-type-name").setValue("workshop");
    await wrapper.get('[data-testid="add-tag-type"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tag-types", {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ name: "workshop", color: "#93c5fd" }),
    });
    expect(wrapper.text()).toContain("workshop");
  });

  it("edits a type from a modal", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/tag-types/3" && init?.method === "PUT") {
        return jsonResponse({
          id: 3,
          name: "profesor",
          color: "#27ae60",
          isDefault: false,
          sortOrder: 3,
          tagCount: 2,
        });
      }

      if (url === "/api/admin/tag-types") {
        return jsonResponse(seedTagTypes);
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createTestRouter();
    await router.push("/admin/tag-types");
    await router.isReady();
    const wrapper = mount(AdminTagTypesView, {
      global: {
        plugins: [router],
        stubs: { ColorPickerField: true },
      },
    });
    await flushPromises();

    await wrapper.get('button[aria-label="Edit teacher"]').trigger("click");
    await wrapper.get("#edit-tag-type-name").setValue("profesor");
    await wrapper.get('[data-testid="save-tag-type"]').trigger("click");
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tag-types/3", {
      headers: { "Content-Type": "application/json" },
      method: "PUT",
      body: JSON.stringify({ name: "profesor", color: "#27ae60" }),
    });
    expect(wrapper.text()).toContain("profesor");
  });
});

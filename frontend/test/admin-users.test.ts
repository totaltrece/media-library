import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import AppHeader from "../src/components/AppHeader.vue";
import { ADMIN_AUTH, VIEW_AUTH, setAuthSessionForTests } from "../src/auth/session.js";
import { routes } from "../src/router.js";
import AdminZoneView from "../src/views/AdminZoneView.vue";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("admin zone", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setAuthSessionForTests(ADMIN_AUTH);
  });

  it("shows the Admin zone link only for admins", async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    });
    await router.push("/");
    await router.isReady();

    setAuthSessionForTests(ADMIN_AUTH);
    const adminHeader = mount(AppHeader, {
      props: { title: "Media Library", subtitle: "" },
      global: { plugins: [router] },
    });
    expect(adminHeader.find('[data-testid="nav-admin-zone"]').exists()).toBe(true);
    expect(adminHeader.find('[data-testid="nav-users"]').exists()).toBe(false);
    expect(adminHeader.find('[data-testid="nav-backup"]').exists()).toBe(false);

    setAuthSessionForTests(VIEW_AUTH);
    const viewHeader = mount(AppHeader, {
      props: { title: "Media Library", subtitle: "" },
      global: { plugins: [router] },
    });
    expect(viewHeader.find('[data-testid="nav-admin-zone"]').exists()).toBe(false);
  });

  it("creates and deletes view users", async () => {
    const users = [{ id: 2, username: "guest", role: "view" as const }];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/users" && init?.method === "POST") {
        return jsonResponse({ id: 3, username: "reader", role: "view" }, true, 201);
      }

      if (url === "/api/admin/users/2" && init?.method === "DELETE") {
        return jsonResponse({ id: 2 });
      }

      if (url === "/api/admin/users") {
        return jsonResponse({ count: users.length, users });
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    });
    await router.push("/admin");
    await router.isReady();
    const wrapper = mount(AdminZoneView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("guest");

    await wrapper.get('[data-testid="new-user-username"]').setValue("reader");
    await wrapper.get('[data-testid="new-user-password"]').setValue("password1");
    await wrapper.get("form.user-create").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("reader");

    await wrapper.get('[data-testid="delete-user"]').trigger("click");
    await wrapper.get('[data-testid="confirm-delete-user"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).not.toContain("guest");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/users/2", expect.objectContaining({ method: "DELETE" }));
  });
});

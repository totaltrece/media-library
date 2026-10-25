import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import { ADMIN_AUTH, setAuthSessionForTests } from "../src/auth/session.js";
import { routes } from "../src/router.js";
import AdminZoneView from "../src/views/AdminZoneView.vue";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("admin backup", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    setAuthSessionForTests(ADMIN_AUTH);
  });

  it("creates a MariaDB to SQLite backup from Admin zone", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/backup" && init?.method === "POST") {
        return jsonResponse({
          sqlitePath: "C:\\data\\library.sqlite",
          tagTypes: 5,
          tags: 10,
          videos: 3,
          relations: 4,
          users: 2,
        });
      }

      if (url === "/api/admin/users") {
        return jsonResponse({ count: 0, users: [] });
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

    expect(wrapper.text()).toContain("Admin zone");
    expect(wrapper.text()).toContain("Admin users");
    expect(wrapper.text()).toContain("Backup db");

    await wrapper.get('[data-testid="create-backup"]').trigger("click");
    await flushPromises();

    expect(wrapper.get('[data-testid="backup-result"]').text()).toContain("3 videos");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/backup", expect.objectContaining({ method: "POST" }));
  });
});

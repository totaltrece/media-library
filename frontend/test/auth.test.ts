import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import AppHeader from "../src/components/AppHeader.vue";
import { ANONYMOUS_AUTH, setAuthSessionForTests } from "../src/auth/session.js";
import { routes } from "../src/router.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe("header auth", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs in from the header modal and logs out again", async () => {
    setAuthSessionForTests(ANONYMOUS_AUTH);

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/auth/login" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { username: string; password: string };
        expect(body).toEqual({ username: "admin", password: "password1" });
        return jsonResponse({ authenticated: true, username: "admin", role: "admin" });
      }

      if (url === "/api/auth/logout" && init?.method === "POST") {
        return jsonResponse({ authenticated: false });
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(AppHeader, {
      props: {
        title: "Media Library",
        subtitle: "Find a video",
      },
      global: {
        plugins: [router],
      },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="auth-login"]').exists()).toBe(true);
    expect(wrapper.get('[aria-label="Refresh library"]').attributes("disabled")).toBeDefined();

    await wrapper.get('[data-testid="auth-login"]').trigger("click");
    await wrapper.get('[data-testid="login-username"]').setValue("admin");
    await wrapper.get('[data-testid="login-password"]').setValue("password1");
    await wrapper.get("form.login-modal").trigger("submit");
    await flushPromises();

    expect(wrapper.get('[data-testid="auth-username"]').text()).toBe("admin");
    expect(wrapper.get('[aria-label="Refresh library"]').attributes("disabled")).toBeUndefined();

    await wrapper.get('[data-testid="auth-logout"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="auth-login"]').exists()).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST" && String(init.body ?? "").includes("password1"))).toBe(true);
  });
});

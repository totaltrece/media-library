import { computed, ref } from "vue";

import {
  fetchAuthMe,
  login as loginRequest,
  logout as logoutRequest,
} from "../api/client.js";
import type { AuthMe } from "../api/types.js";

export const ANONYMOUS_AUTH: AuthMe = { authenticated: false };
export const ADMIN_AUTH: AuthMe = { authenticated: true, username: "admin", role: "admin" };
export const VIEW_AUTH: AuthMe = { authenticated: true, username: "viewer", role: "view" };

const session = ref<AuthMe>({ authenticated: false });
let loadPromise: Promise<void> | null = null;

export function resetAuthSession(): void {
  session.value = { authenticated: false };
  loadPromise = null;
}

export function setAuthSessionForTests(me: AuthMe): void {
  session.value = me;
  loadPromise = Promise.resolve();
}

export async function loadAuthSession(): Promise<void> {
  if (loadPromise !== null) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      session.value = await fetchAuthMe();
    } catch {
      session.value = { authenticated: false };
    }
  })();

  return loadPromise;
}

export async function login(username: string, password: string): Promise<AuthMe> {
  const me = await loginRequest(username, password);
  session.value = me;
  loadPromise = Promise.resolve();
  return me;
}

export async function logout(): Promise<void> {
  await logoutRequest();
  session.value = { authenticated: false };
  loadPromise = Promise.resolve();
}

export function useAuth() {
  const canWrite = computed(
    () => session.value.authenticated && session.value.role === "admin",
  );
  const canView = computed(
    () => session.value.authenticated && (session.value.role === "view" || session.value.role === "admin"),
  );
  const username = computed(() => (session.value.authenticated ? session.value.username : null));

  return {
    session,
    canWrite,
    canView,
    username,
    load: loadAuthSession,
    login,
    logout,
  };
}

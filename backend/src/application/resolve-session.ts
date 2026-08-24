import type { AuthStore, AuthUser } from "../ports/auth-store.js";

export function resolveSessionUser(
  authStore: AuthStore,
  token: string | undefined,
  now = new Date(),
): AuthUser | null {
  if (token === undefined || token.length === 0) {
    return null;
  }

  return authStore.findValidSession(token, now)?.user ?? null;
}

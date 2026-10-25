import type { AuthStore, AuthUser } from "../ports/auth-store.js";

export async function resolveSessionUser(
  authStore: AuthStore,
  token: string | undefined,
  now = new Date(),
): Promise<AuthUser | null> {
  if (token === undefined || token.length === 0) {
    return null;
  }

  const session = await authStore.findValidSession(token, now);
  return session?.user ?? null;
}

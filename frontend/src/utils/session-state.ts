export const HOME_SEARCH_TAGS_KEY = "media-library.home.selected-tags";
export const ADMIN_TAGS_FILTER_KEY = "media-library.admin-tags.filter";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readSessionString(key: string): string | null {
  return sessionStore()?.getItem(key) ?? null;
}

export function writeSessionString(key: string, value: string): void {
  const store = sessionStore();

  if (store === null) {
    return;
  }

  if (value.length === 0) {
    store.removeItem(key);
    return;
  }

  store.setItem(key, value);
}

export function readSessionJson<T>(key: string): T | null {
  const raw = readSessionString(key);

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeSessionJson(key: string, value: unknown): void {
  if (value === null || (Array.isArray(value) && value.length === 0)) {
    writeSessionString(key, "");
    return;
  }

  writeSessionString(key, JSON.stringify(value));
}

export function readStoredHomeTags(): string[] {
  const stored = readSessionJson<unknown>(HOME_SEARCH_TAGS_KEY);

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.filter((item): item is string => typeof item === "string" && item.length > 0);
}

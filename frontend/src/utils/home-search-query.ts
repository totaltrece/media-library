import type { LocationQuery } from "vue-router";

export function parseRouteTags(value: unknown): string[] {
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return [];
}

export function sameTags(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

export function homeSearchQuery(tags: string[], untaggedOnly: boolean): LocationQuery {
  if (untaggedOnly) {
    return { untagged: "1" };
  }

  if (tags.length === 1) {
    return { tag: tags[0] };
  }

  if (tags.length > 1) {
    return { tag: tags };
  }

  return {};
}

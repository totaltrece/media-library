import type { CatalogTag, TagType } from "../src/api/types.js";

export const RESOURCE_COLOR = "#93c5fd";

export const seedTagTypes: { count: number; types: TagType[] } = {
  count: 5,
  types: [
    { id: 1, name: "type", color: "#c0392b", isDefault: false, sortOrder: 1, tagCount: 1 },
    { id: 2, name: "style", color: "#f1948a", isDefault: false, sortOrder: 2, tagCount: 0 },
    { id: 3, name: "teacher", color: "#27ae60", isDefault: false, sortOrder: 3, tagCount: 2 },
    { id: 4, name: "location", color: "#8d6e63", isDefault: false, sortOrder: 4, tagCount: 0 },
    { id: 5, name: "resource", color: RESOURCE_COLOR, isDefault: true, sortOrder: 5, tagCount: 0 },
  ],
};

export function tagItems(...names: string[]): Array<{ name: string; color: string }> {
  return names.map((name) => ({ name, color: RESOURCE_COLOR }));
}

export function catalogTag(partial: Partial<CatalogTag> & Pick<CatalogTag, "id" | "name">): CatalogTag {
  return {
    usageCount: 0,
    typeId: 5,
    typeName: "resource",
    color: RESOURCE_COLOR,
    typeSortOrder: 5,
    ...partial,
  };
}

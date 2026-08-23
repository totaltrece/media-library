import { DEFAULT_TAG_COLOR } from "../src/application/tag-type-color.js";

export function tagsWithDefaultColor(names: string[]): Array<{ name: string; color: string }> {
  return names.map((name) => ({ name, color: DEFAULT_TAG_COLOR }));
}

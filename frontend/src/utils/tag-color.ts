export const DEFAULT_TAG_COLOR = "#93c5fd";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function contrastingTextColor(hex: string): string {
  const rgb = parseHexColor(hex);

  if (rgb === null) {
    return "#202124";
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.62 ? "#202124" : "#ffffff";
}

export function tagChipStyle(color: string): { backgroundColor: string; color: string } {
  return {
    backgroundColor: color,
    color: contrastingTextColor(color),
  };
}

export function colorForTag(
  name: string,
  colors: Record<string, string>,
  fallback: string = DEFAULT_TAG_COLOR,
): string {
  return colors[name] ?? fallback;
}

export function tagColorMap(tags: Array<{ name: string; color: string }>): Record<string, string> {
  return Object.fromEntries(tags.map((tag) => [tag.name, tag.color]));
}

function parseHexColor(value: string): Rgb | null {
  const hex = value.trim();
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);

  if (match === null || match[1] === undefined) {
    return null;
  }

  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16),
  };
}

export const DEFAULT_TAG_COLOR = "#93c5fd";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function normalizeTagTypeColor(value: string): string | null {
  const trimmed = value.trim();

  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return null;
  }

  if (trimmed.length === 4) {
    const red = trimmed[1];
    const green = trimmed[2];
    const blue = trimmed[3];

    if (red === undefined || green === undefined || blue === undefined) {
      return null;
    }

    return `#${red}${red}${green}${green}${blue}${blue}`.toLowerCase();
  }

  return trimmed.toLowerCase();
}

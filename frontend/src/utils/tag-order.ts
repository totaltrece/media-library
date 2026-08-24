export function sortTagsByType(
  tags: string[],
  typeSortByName: Record<string, number>,
  fallbackTypeSort = Number.MAX_SAFE_INTEGER,
): string[] {
  return [...tags].sort((firstTag, secondTag) => {
    const firstOrder = typeSortByName[firstTag] ?? fallbackTypeSort;
    const secondOrder = typeSortByName[secondTag] ?? fallbackTypeSort;

    return firstOrder - secondOrder || firstTag.localeCompare(secondTag);
  });
}

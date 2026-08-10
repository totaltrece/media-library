const VIDEO_DATE_PATTERN = /(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/;

export const VIDEO_DATE_PLACEHOLDER = "XX XX XXXX";

export function formatVideoDateFromName(name: string): string {
  const match = name.match(VIDEO_DATE_PATTERN);

  if (match === null) {
    return VIDEO_DATE_PLACEHOLDER;
  }

  const yyyymmdd = match[0];
  const year = yyyymmdd.slice(0, 4);
  const month = yyyymmdd.slice(4, 6);
  const day = yyyymmdd.slice(6, 8);

  return `${day} ${month} ${year}`;
}

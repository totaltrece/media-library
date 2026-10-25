export function fileNameFromMediaId(mediaId: string): string {
  const segments = mediaId.split("/");
  const base = segments[segments.length - 1] ?? "";
  const cleaned = base.replace(/[\r\n\0]/g, "");

  return cleaned.length > 0 ? cleaned : "video";
}

export function contentDispositionAttachment(fileName: string): string {
  const safeName = fileNameFromMediaId(fileName);
  const ascii = safeName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(safeName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

  return `attachment; filename="${ascii.length > 0 ? ascii : "video"}"; filename*=UTF-8''${encoded}`;
}

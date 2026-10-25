const defaultReceiverContentTypes = new Set(["video/mp4", "video/webm"]);

export function isDefaultReceiverCompatible(contentType: string): boolean {
  return defaultReceiverContentTypes.has(contentType);
}

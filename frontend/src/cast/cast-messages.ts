const LOCALHOST_MESSAGE =
  "Chromecast cannot open localhost. Open Media Library with this computer's network address, such as http://192.168.1.20:3000.";

export function castReachabilityMessage(hostname: string): string | null {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1") {
    return LOCALHOST_MESSAGE;
  }

  return null;
}

export function castPlaybackMessage(options: { receiverCompatible: boolean; protocol: string }): string {
  const httpHint =
    options.protocol === "http:"
      ? " This page is HTTP. If the TV stays blank, open Media Library over HTTPS so the Chromecast can fetch the video."
      : "";

  if (!options.receiverCompatible) {
    return `Sent to Chromecast. This format may not play on the TV. MP4 (H.264/AAC) and WebM work best.${httpHint}`;
  }

  return `Playing on Chromecast.${httpHint}`;
}

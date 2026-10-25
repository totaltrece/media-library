import { ApiRequestError } from "../api/client.js";
import { CastUnavailableError } from "./cast-sender.js";

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

export function castSenderUnavailableMessage(protocol: string): string {
  const httpNote =
    protocol === "http:"
      ? " On an http:// page Chrome often disables sending a video, while casting the whole tab still works."
      : "";

  return `This browser did not open media casting.${httpNote} Casting the whole tab does not send the video file.`;
}

export function describeCastError(error: unknown, protocol: string): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  if (error instanceof CastUnavailableError) {
    return castSenderUnavailableMessage(protocol);
  }

  const detail = castErrorDetail(error);

  if (detail.length > 0) {
    return `Unable to start casting (${detail}). The Chromecast must be able to reach this site.`;
  }

  return "Unable to start casting. The Chromecast must be able to reach this site.";
}

function castErrorDetail(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error && error.message.length > 0) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error !== "object" || error === null) {
    return "";
  }

  const record = error as Record<string, unknown>;
  const parts = [record.code, record.description, record.message].flatMap((part) => {
    if (typeof part === "number") {
      return [String(part)];
    }

    if (typeof part === "string" && part.length > 0) {
      return [part];
    }

    return [];
  });

  return parts.join(": ");
}

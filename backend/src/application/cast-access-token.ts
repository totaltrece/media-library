import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_CAST_URL_TTL_MS = 6 * 60 * 60 * 1000;

export interface CastAccessToken {
  token: string;
  expiresAt: Date;
}

export function createCastAccessToken(
  mediaId: string,
  secret: string,
  now: Date,
  ttlMs: number,
): CastAccessToken {
  const expiresAtUnix = Math.floor((now.getTime() + ttlMs) / 1000);
  const signature = signCastAccess(mediaId, expiresAtUnix, secret);

  return {
    token: `${expiresAtUnix}.${signature}`,
    expiresAt: new Date(expiresAtUnix * 1000),
  };
}

export function verifyCastAccessToken(
  mediaId: string,
  token: string,
  secret: string,
  now: Date,
): boolean {
  const separator = token.indexOf(".");

  if (separator <= 0 || separator === token.length - 1) {
    return false;
  }

  const expiresAtUnix = Number(token.slice(0, separator));
  const signature = token.slice(separator + 1);

  if (!Number.isInteger(expiresAtUnix) || expiresAtUnix < 0) {
    return false;
  }

  if (expiresAtUnix * 1000 <= now.getTime()) {
    return false;
  }

  const expected = signCastAccess(mediaId, expiresAtUnix, secret);

  return signaturesMatch(signature, expected);
}

/**
 * Media id encoded in a cast stream URL. Returns undefined for any other path,
 * including tag routes under `/videos/`.
 */
export function mediaIdFromVideoStreamPath(url: string): string | undefined {
  const withoutHash = url.split("#")[0] ?? "";
  const path = withoutHash.split("?")[0] ?? "";
  const marker = "/video/";
  const index = path.indexOf(marker);

  if (index === -1) {
    return undefined;
  }

  const raw = path.slice(index + marker.length);

  if (raw.length === 0) {
    return undefined;
  }

  try {
    const mediaId = raw
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");

    if (mediaId.length === 0 || mediaId.includes("\0")) {
      return undefined;
    }

    return mediaId;
  } catch {
    return undefined;
  }
}

export function encodeMediaIdPath(mediaId: string): string {
  return mediaId
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function signCastAccess(mediaId: string, expiresAtUnix: number, secret: string): string {
  return createHmac("sha256", secret).update(`${mediaId}\n${expiresAtUnix}`).digest("base64url");
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);

  if (actualBytes.length !== expectedBytes.length) {
    return false;
  }

  return timingSafeEqual(actualBytes, expectedBytes);
}

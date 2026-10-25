import { randomBytes } from "node:crypto";

import { DEFAULT_CAST_URL_TTL_MS } from "./cast-access-token.js";

const MIN_CAST_URL_TTL_SECONDS = 60;
const MAX_CAST_URL_TTL_SECONDS = 24 * 60 * 60;

export interface CastConfig {
  castUrlSecret: string;
  castUrlTtlMs: number;
}

export function resolveCastConfig(env: NodeJS.Dict<string>): CastConfig {
  return {
    castUrlSecret: resolveCastUrlSecret(env.CAST_URL_SECRET),
    castUrlTtlMs: resolveCastUrlTtlMs(env.CAST_URL_TTL_SECONDS),
  };
}

export function resolveCastUrlSecret(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";

  if (trimmed.length > 0) {
    return trimmed;
  }

  return randomBytes(32).toString("hex");
}

export function resolveCastUrlTtlMs(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return DEFAULT_CAST_URL_TTL_MS;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < MIN_CAST_URL_TTL_SECONDS || parsed > MAX_CAST_URL_TTL_SECONDS) {
    throw new Error(
      `CAST_URL_TTL_SECONDS must be an integer from ${MIN_CAST_URL_TTL_SECONDS} to ${MAX_CAST_URL_TTL_SECONDS}.`,
    );
  }

  return parsed * 1000;
}

import { randomBytes } from "node:crypto";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_TOKEN_BYTES = 32;

export function createSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex");
}

export function sessionExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_DURATION_MS);
}

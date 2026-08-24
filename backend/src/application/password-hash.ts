import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const HASH_PREFIX = "scrypt";

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derived = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    HASH_PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parsed = parseStoredHash(storedHash);

  if (parsed === null) {
    return false;
  }

  try {
    const derived = scryptSync(password, parsed.salt, parsed.keyLength, {
      N: parsed.N,
      r: parsed.r,
      p: parsed.p,
    });

    if (derived.length !== parsed.hash.length) {
      return false;
    }

    return timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

function parseStoredHash(storedHash: string): {
  N: number;
  r: number;
  p: number;
  keyLength: number;
  salt: Buffer;
  hash: Buffer;
} | null {
  const parts = storedHash.split("$");

  if (parts.length !== 6 || parts[0] !== HASH_PREFIX) {
    return null;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4];
  const hashHex = parts[5];

  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N <= 0 ||
    r <= 0 ||
    p <= 0 ||
    saltHex === undefined ||
    hashHex === undefined ||
    saltHex.length === 0 ||
    hashHex.length === 0 ||
    hashHex.length % 2 !== 0
  ) {
    return null;
  }

  return {
    N,
    r,
    p,
    keyLength: hashHex.length / 2,
    salt: Buffer.from(saltHex, "hex"),
    hash: Buffer.from(hashHex, "hex"),
  };
}

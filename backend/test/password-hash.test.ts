import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword, verifyPassword } from "../src/application/password-hash.js";

test("hashPassword produces a verifiable scrypt hash", () => {
  const hash = hashPassword("correct-horse");

  assert.match(hash, /^scrypt\$16384\$8\$1\$[0-9a-f]+\$[0-9a-f]+$/);
  assert.equal(verifyPassword("correct-horse", hash), true);
  assert.equal(verifyPassword("wrong-password", hash), false);
});

test("verifyPassword rejects malformed stored hashes", () => {
  assert.equal(verifyPassword("secret", "not-a-hash"), false);
  assert.equal(verifyPassword("secret", "scrypt$1$1$1$zz$zz"), false);
});

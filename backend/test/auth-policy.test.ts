import assert from "node:assert/strict";
import { test } from "node:test";

import { authorizeRequest, canRead, canWrite } from "../src/application/auth-policy.js";

test("canWrite is true only for admin principals", () => {
  assert.equal(canWrite(null), false);
  assert.equal(canWrite({ username: "viewer", role: "view" }), false);
  assert.equal(canWrite({ username: "admin", role: "admin" }), true);
});

test("canRead allows anonymous access when public-read is on", () => {
  assert.equal(canRead(null, true), true);
  assert.equal(canRead(null, false), false);
  assert.equal(canRead({ username: "viewer", role: "view" }, false), true);
  assert.equal(canRead({ username: "admin", role: "admin" }, false), true);
});

test("authorizeRequest allows login, logout, and me without a session", () => {
  assert.deepEqual(
    authorizeRequest({ method: "POST", path: "/api/auth/login", principal: null, publicRead: true }),
    { ok: true },
  );
  assert.deepEqual(
    authorizeRequest({ method: "POST", path: "/api/auth/logout", principal: null, publicRead: true }),
    { ok: true },
  );
  assert.deepEqual(
    authorizeRequest({ method: "GET", path: "/api/auth/me", principal: null, publicRead: false }),
    { ok: true },
  );
});

test("authorizeRequest rejects anonymous writes with 401", () => {
  assert.deepEqual(
    authorizeRequest({ method: "POST", path: "/api/admin/tag-types", principal: null, publicRead: true }),
    { ok: false, status: 401, message: "Authentication required" },
  );
});

test("authorizeRequest rejects view-role writes with 403", () => {
  assert.deepEqual(
    authorizeRequest({
      method: "PUT",
      path: "/api/admin/tags/1",
      principal: { username: "viewer", role: "view" },
      publicRead: true,
    }),
    { ok: false, status: 403, message: "Admin access required" },
  );
});

test("authorizeRequest requires a session for GET when public-read is off", () => {
  assert.deepEqual(
    authorizeRequest({ method: "GET", path: "/api/search", principal: null, publicRead: false }),
    { ok: false, status: 401, message: "Authentication required" },
  );
  assert.deepEqual(
    authorizeRequest({
      method: "GET",
      path: "/api/search",
      principal: { username: "viewer", role: "view" },
      publicRead: false,
    }),
    { ok: true },
  );
});

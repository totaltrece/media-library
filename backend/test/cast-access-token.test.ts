import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCastAccessToken,
  mediaIdFromVideoStreamPath,
  verifyCastAccessToken,
} from "../src/application/cast-access-token.js";
import { isDefaultReceiverCompatible } from "../src/application/cast-receiver-compatibility.js";
import { resolveCastUrlSecret, resolveCastUrlTtlMs } from "../src/application/resolve-cast-config.js";
import { contentTypeForVideoPath } from "../src/application/video-content-type.js";

const now = new Date("2026-10-25T12:00:00.000Z");

test("cast access tokens are bound to one media id and an expiry", () => {
  const issued = createCastAccessToken("salsa/my clip.mp4", "secret", now, 1000);

  assert.equal(verifyCastAccessToken("salsa/my clip.mp4", issued.token, "secret", now), true);
  assert.equal(verifyCastAccessToken("salsa/other.mp4", issued.token, "secret", now), false);
  assert.equal(verifyCastAccessToken("salsa/my clip.mp4", issued.token, "other-secret", now), false);
  assert.equal(verifyCastAccessToken("salsa/my clip.mp4", `${issued.token}x`, "secret", now), false);
  assert.equal(
    verifyCastAccessToken("salsa/my clip.mp4", issued.token, "secret", new Date(issued.expiresAt.getTime())),
    false,
  );
});

test("mediaIdFromVideoStreamPath reads only video stream paths", () => {
  assert.equal(mediaIdFromVideoStreamPath("/api/video/salsa/my%20clip.mp4?cast=1.abc"), "salsa/my clip.mp4");
  assert.equal(mediaIdFromVideoStreamPath("/api/videos/salsa/clip.mp4"), undefined);
  assert.equal(mediaIdFromVideoStreamPath("/api/thumbnail/salsa/clip.mp4"), undefined);
  assert.equal(mediaIdFromVideoStreamPath("/api/video/"), undefined);
});

test("resolveCastUrlTtlMs defaults to six hours and rejects out-of-range values", () => {
  assert.equal(resolveCastUrlTtlMs(undefined), 6 * 60 * 60 * 1000);
  assert.equal(resolveCastUrlTtlMs("120"), 120_000);
  assert.throws(() => resolveCastUrlTtlMs("10"), /CAST_URL_TTL_SECONDS/);
  assert.throws(() => resolveCastUrlTtlMs("999999"), /CAST_URL_TTL_SECONDS/);
});

test("resolveCastUrlSecret keeps a configured secret and generates one when missing", () => {
  assert.equal(resolveCastUrlSecret("  configured  "), "configured");
  assert.match(resolveCastUrlSecret(undefined), /^[a-f0-9]{64}$/);
});

test("default receiver compatibility follows the content type Chromecast can play", () => {
  assert.equal(contentTypeForVideoPath("clip.mp4"), "video/mp4");
  assert.equal(contentTypeForVideoPath("clip.m4v"), "video/mp4");
  assert.equal(contentTypeForVideoPath("clip.webm"), "video/webm");
  assert.equal(contentTypeForVideoPath("clip.ts"), "video/mp2t");
  assert.equal(isDefaultReceiverCompatible("video/mp4"), true);
  assert.equal(isDefaultReceiverCompatible("video/webm"), true);
  assert.equal(isDefaultReceiverCompatible("video/x-matroska"), false);
});

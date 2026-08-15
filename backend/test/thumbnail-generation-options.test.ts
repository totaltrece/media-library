import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_THUMBNAIL_HEIGHT,
  DEFAULT_THUMBNAIL_POSITION_RATIO,
  DEFAULT_THUMBNAIL_WIDTH,
  resolveThumbnailGenerationOptions,
} from "../src/application/thumbnail-generation-options.js";

test("resolveThumbnailGenerationOptions uses the current 281x500 defaults", () => {
  assert.deepEqual(resolveThumbnailGenerationOptions(), {
    width: DEFAULT_THUMBNAIL_WIDTH,
    height: DEFAULT_THUMBNAIL_HEIGHT,
    positionRatio: DEFAULT_THUMBNAIL_POSITION_RATIO,
  });
  assert.deepEqual(resolveThumbnailGenerationOptions({ positionRatio: 0.25 }), {
    width: 281,
    height: 500,
    positionRatio: 0.25,
  });
});

test("resolveThumbnailGenerationOptions rejects invalid dimensions and positions", () => {
  assert.throws(() => resolveThumbnailGenerationOptions({ width: 0 }), /width must be a positive integer/);
  assert.throws(() => resolveThumbnailGenerationOptions({ height: -1 }), /height must be a positive integer/);
  assert.throws(() => resolveThumbnailGenerationOptions({ positionRatio: 1.1 }), /position ratio must be between 0 and 1/);
  assert.throws(() => resolveThumbnailGenerationOptions({ positionRatio: Number.NaN }), /position ratio must be between 0 and 1/);
});

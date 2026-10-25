import assert from "node:assert/strict";
import { test } from "node:test";

import { contentDispositionAttachment, fileNameFromMediaId } from "../src/application/content-disposition.js";

test("contentDispositionAttachment uses the file name and escapes header characters", () => {
  assert.equal(fileNameFromMediaId("salsa/my clip.mp4"), "my clip.mp4");
  assert.equal(
    contentDispositionAttachment("salsa/my clip.mp4"),
    "attachment; filename=\"my clip.mp4\"; filename*=UTF-8''my%20clip.mp4",
  );
  assert.equal(
    contentDispositionAttachment("quotes\".mp4"),
    "attachment; filename=\"quotes_.mp4\"; filename*=UTF-8''quotes%22.mp4",
  );
});

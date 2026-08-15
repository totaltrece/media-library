import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { buildProcessingJobPaths } from "../src/application/processing-job-paths.js";

test("buildProcessingJobPaths keeps job files under a dedicated temp directory", () => {
  const tempRoot = join("data", "upload-temp");
  const jobId = "6f1d2c3a-4b5e-6789-abcd-ef0123456789";

  assert.deepEqual(buildProcessingJobPaths(tempRoot, jobId), {
    directory: join(tempRoot, jobId),
    sourcePath: join(tempRoot, jobId, "source"),
    convertedPath: join(tempRoot, jobId, "converted.mp4"),
    thumbnailPath: join(tempRoot, jobId, "thumbnail.jpg"),
  });
});

test("buildProcessingJobPaths rejects empty roots and unsafe job ids", () => {
  assert.throws(() => buildProcessingJobPaths("", "job-1"), /temp root must not be empty/);
  assert.throws(() => buildProcessingJobPaths("tmp", "../outside"), /Invalid processing job id/);
  assert.throws(() => buildProcessingJobPaths("tmp", "job/nested"), /Invalid processing job id/);
  assert.throws(() => buildProcessingJobPaths("tmp", "job\\nested"), /Invalid processing job id/);
});

import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryProcessingJobStore } from "../src/adapters/in-memory-processing-job-store.js";
import { createProcessingJob, transitionProcessingJob } from "../src/application/processing-job.js";

test("InMemoryProcessingJobStore tracks jobs and the single active processing job", () => {
  const store = new InMemoryProcessingJobStore();
  const idle = createProcessingJob({ originalName: "one.mp4", id: "job-1" });
  const uploading = transitionProcessingJob(
    createProcessingJob({ originalName: "two.mp4", id: "job-2" }),
    { status: "uploading" },
  );

  store.create(idle);
  store.create(uploading);

  assert.deepEqual(store.findById("job-1"), idle);
  assert.equal(store.findActive()?.id, "job-2");

  const completed = transitionProcessingJob(
    transitionProcessingJob(
      transitionProcessingJob(
        transitionProcessingJob(uploading, { status: "processing", phase: "processing" }),
        { status: "processing", phase: "generating_thumbnail" },
      ),
      { status: "processing", phase: "finalizing" },
    ),
    { status: "completed", videoId: "two.mp4" },
  );
  store.update(completed);

  assert.equal(store.findActive(), null);
  assert.equal(store.list().length, 2);
  assert.throws(() => store.create(idle), /already exists: job-1/);
  assert.throws(() => store.update(createProcessingJob({ originalName: "missing.mp4", id: "missing" })), /not found: missing/);
});

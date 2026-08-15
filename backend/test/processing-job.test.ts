import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTransitionProcessingJob,
  createProcessingJob,
  InvalidProcessingJobTransitionError,
  isActiveProcessingJob,
  isTerminalProcessingJob,
  processingJobPhase,
  transitionProcessingJob,
} from "../src/application/processing-job.js";

test("createProcessingJob starts idle and rejects an empty name", () => {
  const job = createProcessingJob({
    originalName: "  clip.mp4  ",
    id: "job-1",
    createdAt: "2026-08-15T10:00:00.000Z",
  });

  assert.deepEqual(job, {
    id: "job-1",
    originalName: "clip.mp4",
    createdAt: "2026-08-15T10:00:00.000Z",
    state: { status: "idle" },
    converted: null,
    progress: null,
  });
  assert.equal(isActiveProcessingJob(job), false);
  assert.equal(isTerminalProcessingJob(job), false);
  assert.throws(() => createProcessingJob({ originalName: "   " }), /original name must not be empty/);
});

test("processing jobs follow the upload to completed path", () => {
  let job = createProcessingJob({ originalName: "clip.mp4", id: "job-1" });

  job = transitionProcessingJob(job, { status: "uploading" });
  assert.equal(isActiveProcessingJob(job), true);
  assert.equal(processingJobPhase(job.state), "uploading");

  job = transitionProcessingJob(job, { status: "processing", phase: "processing" });
  job = transitionProcessingJob(job, { status: "processing", phase: "generating_thumbnail" });
  job = transitionProcessingJob(job, { status: "processing", phase: "finalizing" });
  job = transitionProcessingJob(job, { status: "processing", phase: "installing" });
  job = transitionProcessingJob(job, { status: "completed", videoId: "clip.mp4" });

  assert.equal(isActiveProcessingJob(job), false);
  assert.equal(isTerminalProcessingJob(job), true);
  assert.deepEqual(job.state, { status: "completed", videoId: "clip.mp4" });
  assert.equal(processingJobPhase(job.state), "completed");
  assert.equal(
    canTransitionProcessingJob(
      { status: "processing", phase: "finalizing" },
      { status: "completed", videoId: "clip.mp4" },
    ),
    true,
  );
});

test("a processing job can fail from an active step without skipping ahead", () => {
  const uploading = transitionProcessingJob(createProcessingJob({ originalName: "clip.mp4" }), {
    status: "uploading",
  });
  const failed = transitionProcessingJob(uploading, { status: "failed", error: "disk full" });

  assert.deepEqual(failed.state, { status: "failed", error: "disk full" });
  assert.equal(isTerminalProcessingJob(failed), true);
  assert.equal(
    canTransitionProcessingJob(uploading.state, { status: "processing", phase: "generating_thumbnail" }),
    false,
  );
  assert.equal(canTransitionProcessingJob(failed.state, { status: "uploading" }), false);
  assert.throws(
    () => transitionProcessingJob(failed, { status: "idle" }),
    (error: unknown) => error instanceof InvalidProcessingJobTransitionError,
  );
});

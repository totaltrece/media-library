import assert from "node:assert/strict";
import { test } from "node:test";

import { InMemoryProcessingJobStore } from "../src/adapters/in-memory-processing-job-store.js";
import { BackgroundUploadJobRunner } from "../src/application/background-upload-job-runner.js";
import type { CompleteUploadResult, CompleteUploadUseCase } from "../src/application/complete-upload.js";
import { createProcessingJob, transitionProcessingJob } from "../src/application/processing-job.js";
import type { ProcessVideoJobUseCase } from "../src/application/process-video-job.js";

test("BackgroundUploadJobRunner records unexpected errors without rejecting", async () => {
  const jobs = new InMemoryProcessingJobStore();
  let job = createProcessingJob({ originalName: "clip.mp4", id: "job-1" });
  job = transitionProcessingJob(job, { status: "uploading" });
  jobs.create(job);

  const logged: Array<{ jobId: string; error: unknown }> = [];
  const failCalls: string[] = [];
  const complete = {
    execute: async () => {
      throw new Error("boom");
    },
  } as unknown as CompleteUploadUseCase;
  const processVideoJob = {
    failActiveJob: async (jobId: string) => {
      failCalls.push(jobId);
      jobs.update(transitionProcessingJob(jobs.findById(jobId)!, { status: "failed", error: "boom" }));
    },
  } as unknown as ProcessVideoJobUseCase;

  const runner = new BackgroundUploadJobRunner(complete, processVideoJob, jobs, (jobId, error) => {
    logged.push({ jobId, error });
  });

  runner.start("job-1");
  await runner.waitFor("job-1");

  assert.equal(jobs.findById("job-1")?.state.status, "failed");
  assert.deepEqual(failCalls, ["job-1"]);
  assert.equal(logged.length, 1);
  assert.equal(logged[0]?.jobId, "job-1");
});

test("BackgroundUploadJobRunner does not discard a job already marked failed", async () => {
  const jobs = new InMemoryProcessingJobStore();
  let job = createProcessingJob({ originalName: "clip.mp4", id: "job-2" });
  job = transitionProcessingJob(job, { status: "uploading" });
  jobs.create(job);

  const failCalls: string[] = [];
  const complete = {
    execute: async (): Promise<CompleteUploadResult> => {
      const failed = transitionProcessingJob(jobs.findById("job-2")!, { status: "failed", error: "install failed" });
      jobs.update(failed);
      return {
        status: "failed",
        jobId: "job-2",
        originalName: "clip.mp4",
        error: "install failed",
        job: failed,
        conflict: false,
        stage: "installing",
      };
    },
  } as unknown as CompleteUploadUseCase;
  const processVideoJob = {
    failActiveJob: async (jobId: string) => {
      failCalls.push(jobId);
    },
  } as unknown as ProcessVideoJobUseCase;

  const runner = new BackgroundUploadJobRunner(complete, processVideoJob, jobs, () => undefined);
  runner.start("job-2");
  await runner.waitFor("job-2");

  assert.equal(jobs.findById("job-2")?.state.status, "failed");
  assert.deepEqual(failCalls, []);
});

test("BackgroundUploadJobRunner starts the oldest queued job when the active one finishes", async () => {
  const jobs = new InMemoryProcessingJobStore();
  const first = transitionProcessingJob(createProcessingJob({ originalName: "one.mp4", id: "job-1" }), {
    status: "uploading",
  });
  const second = transitionProcessingJob(createProcessingJob({ originalName: "two.mp4", id: "job-2" }), {
    status: "queued",
  });
  jobs.create(first);
  jobs.create(second);

  const started: string[] = [];
  const complete = {
    execute: async (jobId: string): Promise<CompleteUploadResult> => {
      started.push(jobId);
      const current = jobs.findById(jobId);
      if (current === null) {
        throw new Error(`missing ${jobId}`);
      }
      const failed = transitionProcessingJob(current, { status: "failed", error: "done" });
      jobs.update(failed);
      return {
        status: "failed",
        jobId,
        originalName: current.originalName,
        error: "done",
        job: failed,
        conflict: false,
        stage: "processing",
      };
    },
  } as unknown as CompleteUploadUseCase;
  const processVideoJob = {
    failActiveJob: async () => undefined,
    promoteQueued: (jobId: string) => {
      const current = jobs.findById(jobId);
      if (current === null) {
        throw new Error(`missing ${jobId}`);
      }
      const uploading = transitionProcessingJob(current, { status: "uploading" });
      jobs.update(uploading);
      return uploading;
    },
  } as unknown as ProcessVideoJobUseCase;

  const runner = new BackgroundUploadJobRunner(complete, processVideoJob, jobs, () => undefined);
  runner.start("job-1");
  await runner.waitFor("job-1");
  await runner.waitForIdle();

  assert.deepEqual(started, ["job-1", "job-2"]);
  assert.equal(jobs.findById("job-2")?.state.status, "failed");
});

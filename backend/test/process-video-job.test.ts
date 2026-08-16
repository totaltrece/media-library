import assert from "node:assert/strict";
import { test } from "node:test";

import { ActiveProcessingJobError } from "../src/application/active-processing-job-error.js";
import { ProcessVideoJobUseCase } from "../src/application/process-video-job.js";
import { toCanonicalPxlFileName } from "../src/application/resolve-canonical-upload-name.js";
import { createProcessingJob, transitionProcessingJob } from "../src/application/processing-job.js";
import { InMemoryProcessingJobStore } from "../src/adapters/in-memory-processing-job-store.js";
import { buildProcessingJobPaths } from "../src/application/processing-job-paths.js";
import type { ProcessingJobPaths, ProcessingWorkspace } from "../src/ports/processing-workspace.js";
import type { VideoConvertOptions, VideoProbeResult, VideoProcessor } from "../src/ports/video-processor.js";

const originalPath = "/library/clip.mp4";
const tempRoot = "/tmp/upload-temp";

test("HEVC jobs convert, thumbnail the converted file, and keep the workspace", async () => {
  const { useCase, processor, workspace, jobs } = createHarness({
    probe: probeResult("hevc"),
  });

  const result = await useCase.execute({
    inputPath: originalPath,
    originalName: "clip.mp4",
    jobId: "job-1",
  });

  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }

  const paths = buildProcessingJobPaths(tempRoot, "job-1");
  assert.deepEqual(processor.probeCalls, [paths.sourcePath]);
  assert.deepEqual(processor.convertCalls, [{ input: paths.sourcePath, output: paths.convertedPath }]);
  assert.deepEqual(processor.thumbnailCalls, [{ input: paths.convertedPath, output: paths.thumbnailPath }]);
  assert.equal(result.converted, true);
  assert.equal(result.job.progress, 100);
  assert.equal(result.outputVideoPath, paths.convertedPath);
  assert.equal(result.thumbnailPath, paths.thumbnailPath);
  assert.equal(result.workspaceDirectory, paths.directory);
  assert.deepEqual(result.job.state, { status: "completed", videoId: "clip.mp4" });
  assert.deepEqual(workspace.staged, [{ jobId: "job-1", inputPath: originalPath }]);
  assert.ok(workspace.prepared.length >= 1);
  assert.ok(workspace.prepared.every((id) => id === "job-1"));
  assert.deepEqual(workspace.discarded, []);
  assert.equal(jobs.findActive(), null);
  assert.equal(processor.touched(originalPath), false);
});

test("H.264 jobs skip convert and thumbnail the staged source", async () => {
  const { useCase, processor, workspace } = createHarness({
    probe: probeResult("h264"),
  });

  const result = await useCase.execute({
    inputPath: originalPath,
    originalName: "clip.mp4",
    jobId: "job-h264",
  });

  assert.equal(result.status, "completed");
  if (result.status !== "completed") {
    return;
  }

  const paths = buildProcessingJobPaths(tempRoot, "job-h264");
  assert.deepEqual(processor.convertCalls, []);
  assert.deepEqual(processor.thumbnailCalls, [{ input: paths.sourcePath, output: paths.thumbnailPath }]);
  assert.equal(result.converted, false);
  assert.equal(result.job.progress, null);
  assert.equal(result.outputVideoPath, paths.sourcePath);
  assert.deepEqual(workspace.discarded, []);
  assert.equal(processor.touched(originalPath), false);
});

test("non-HEVC codecs are not converted", async () => {
  const { useCase, processor } = createHarness({
    probe: probeResult("mpeg4"),
  });

  const result = await useCase.execute({
    inputPath: originalPath,
    originalName: "clip.mp4",
    jobId: "job-mpeg4",
  });

  assert.equal(result.status, "completed");
  assert.deepEqual(processor.convertCalls, []);
});

test("probe errors fail the job and discard the workspace", async () => {
  const { useCase, processor, workspace, jobs } = createHarness({
    failAt: "probe",
  });

  const result = await useCase.execute({
    inputPath: originalPath,
    originalName: "clip.mp4",
    jobId: "job-probe",
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.match(result.error, /probe failed/);
  assert.deepEqual(result.job.state, { status: "failed", error: "probe failed" });
  assert.deepEqual(processor.convertCalls, []);
  assert.deepEqual(processor.thumbnailCalls, []);
  assert.deepEqual(workspace.discarded, ["job-probe"]);
  assert.equal(jobs.findById("job-probe")?.state.status, "failed");
});

test("conversion errors fail the job and do not complete", async () => {
  const { useCase, processor, workspace } = createHarness({
    probe: probeResult("hevc"),
    failAt: "convert",
  });

  const result = await useCase.execute({
    inputPath: originalPath,
    originalName: "clip.mp4",
    jobId: "job-convert",
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.match(result.error, /convert failed/);
  assert.equal(result.job.state.status, "failed");
  assert.deepEqual(processor.thumbnailCalls, []);
  assert.deepEqual(workspace.discarded, ["job-convert"]);
});

test("thumbnail errors fail the job and do not complete", async () => {
  const { useCase, workspace } = createHarness({
    probe: probeResult("h264"),
    failAt: "thumbnail",
  });

  const result = await useCase.execute({
    inputPath: originalPath,
    originalName: "clip.mp4",
    jobId: "job-thumb",
  });

  assert.equal(result.status, "failed");
  if (result.status !== "failed") {
    return;
  }

  assert.match(result.error, /thumbnail failed/);
  assert.equal(result.job.state.status, "failed");
  assert.deepEqual(workspace.discarded, ["job-thumb"]);
});

test("an active job prevents another processing run", async () => {
  const jobs = new InMemoryProcessingJobStore();
  const uploading = transitionProcessingJob(
    createProcessingJob({ originalName: "busy.mp4", id: "busy" }),
    { status: "uploading" },
  );
  jobs.create(uploading);

  const { useCase, processor, workspace } = createHarness({ jobs });

  await assert.rejects(
    () => useCase.execute({ inputPath: originalPath, originalName: "clip.mp4", jobId: "job-2" }),
    (error: unknown) => {
      assert.ok(error instanceof ActiveProcessingJobError);
      assert.equal(error.jobId, "busy");
      return true;
    },
  );
  assert.equal(processor.probeCalls.length, 0);
  assert.deepEqual(workspace.prepared, []);
  assert.equal(jobs.findActive()?.id, "busy");
});

test("processStaged stops at finalizing so install can complete the job", async () => {
  const { useCase, workspace, jobs } = createHarness({
    probe: probeResult("h264"),
  });

  const started = await useCase.begin({ originalName: "clip.mp4", jobId: "job-staged" });
  await workspace.stageSource(started.job.id, originalPath);
  const result = await useCase.processStaged(started.job.id);

  assert.equal(result.status, "processed");
  if (result.status !== "processed") {
    return;
  }

  assert.deepEqual(result.job.state, { status: "processing", phase: "finalizing" });
  assert.equal(jobs.findActive()?.id, "job-staged");
  assert.deepEqual(workspace.discarded, []);
});

test("processStaged keeps a PXL name that already contains a recording date", async () => {
  const { useCase, workspace } = createHarness({
    probe: probeResult("h264", "2020-01-01T00:00:00.000Z"),
  });

  const started = await useCase.begin({
    originalName: "PXL_20260314_200431123.mp4",
    jobId: "job-pxl",
  });
  await workspace.stageSource(started.job.id, originalPath);
  const result = await useCase.processStaged(started.job.id);

  assert.equal(result.status, "processed");
  if (result.status !== "processed") {
    return;
  }

  assert.equal(result.originalName, "PXL_20260314_200431123.mp4");
  assert.equal(result.job.originalName, "PXL_20260314_200431123.mp4");
});

test("processStaged renames an Android MediaStore file from video metadata", async () => {
  const recordingTime = "2026-03-14T19:04:31.123Z";
  const expected = toCanonicalPxlFileName(new Date(recordingTime), ".mp4");
  const { useCase, workspace, jobs } = createHarness({
    probe: probeResult("h264", recordingTime),
  });

  const started = await useCase.begin({ originalName: "1000141506.mp4", jobId: "job-android" });
  await workspace.stageSource(started.job.id, originalPath);
  const result = await useCase.processStaged(started.job.id);

  assert.equal(result.status, "processed");
  if (result.status !== "processed") {
    return;
  }

  assert.equal(result.originalName, expected);
  assert.equal(result.job.originalName, expected);
  assert.equal(jobs.findById("job-android")?.originalName, expected);
  assert.match(expected, /^PXL_\d{8}_\d{9}\.mp4$/);
});

test("processStaged keeps a MediaStore name when metadata has no reliable date", async () => {
  const { useCase, workspace } = createHarness({
    probe: probeResult("h264", "1970-01-01T00:00:00.000000Z"),
  });

  const started = await useCase.begin({ originalName: "1000141506.mp4", jobId: "job-nodate" });
  await workspace.stageSource(started.job.id, originalPath);
  const result = await useCase.processStaged(started.job.id);

  assert.equal(result.status, "processed");
  if (result.status !== "processed") {
    return;
  }

  assert.equal(result.originalName, "1000141506.mp4");
  assert.equal(result.job.originalName, "1000141506.mp4");
});

function probeResult(videoCodec: string, recordingTime: string | null = null): VideoProbeResult {
  return {
    durationSeconds: 4,
    width: 1080,
    height: 1920,
    videoCodec,
    audioCodec: "aac",
    recordingTime,
  };
}

function createHarness(options?: {
  probe?: VideoProbeResult;
  failAt?: "probe" | "convert" | "thumbnail";
  jobs?: InMemoryProcessingJobStore;
}): {
  useCase: ProcessVideoJobUseCase;
  processor: FakeVideoProcessor;
  workspace: FakeProcessingWorkspace;
  jobs: InMemoryProcessingJobStore;
} {
  const processor = new FakeVideoProcessor(options?.probe ?? probeResult("hevc"), options?.failAt);
  const workspace = new FakeProcessingWorkspace();
  const jobs = options?.jobs ?? new InMemoryProcessingJobStore();

  return {
    useCase: new ProcessVideoJobUseCase(processor, workspace, jobs),
    processor,
    workspace,
    jobs,
  };
}

class FakeVideoProcessor implements VideoProcessor {
  readonly probeCalls: string[] = [];
  readonly convertCalls: Array<{ input: string; output: string }> = [];
  readonly thumbnailCalls: Array<{ input: string; output: string }> = [];

  constructor(
    private readonly probeResult: VideoProbeResult,
    private readonly failAt?: "probe" | "convert" | "thumbnail",
  ) {}

  async probe(inputPath: string): Promise<VideoProbeResult> {
    this.probeCalls.push(inputPath);
    if (this.failAt === "probe") {
      throw new Error("probe failed");
    }

    return this.probeResult;
  }

  async convert(inputPath: string, outputPath: string, options?: VideoConvertOptions): Promise<void> {
    this.convertCalls.push({ input: inputPath, output: outputPath });
    options?.onProgress?.(47);
    options?.onProgress?.(150);
    if (this.failAt === "convert") {
      throw new Error("convert failed");
    }
  }

  async generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
    this.thumbnailCalls.push({ input: inputPath, output: outputPath });
    if (this.failAt === "thumbnail") {
      throw new Error("thumbnail failed");
    }
  }

  touched(path: string): boolean {
    return (
      this.probeCalls.includes(path) ||
      this.convertCalls.some((call) => call.input === path || call.output === path) ||
      this.thumbnailCalls.some((call) => call.input === path || call.output === path)
    );
  }
}

class FakeProcessingWorkspace implements ProcessingWorkspace {
  readonly prepared: string[] = [];
  readonly staged: Array<{ jobId: string; inputPath: string }> = [];
  readonly discarded: string[] = [];

  async prepareJob(jobId: string): Promise<ProcessingJobPaths> {
    this.prepared.push(jobId);
    return buildProcessingJobPaths(tempRoot, jobId);
  }

  async stageSource(jobId: string, inputPath: string): Promise<ProcessingJobPaths> {
    this.staged.push({ jobId, inputPath });
    return buildProcessingJobPaths(tempRoot, jobId);
  }

  async discardJob(jobId: string): Promise<void> {
    this.discarded.push(jobId);
  }
}

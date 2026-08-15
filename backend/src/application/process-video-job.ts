import type { ProcessingJobStore } from "../ports/processing-job-store.js";
import type { ProcessingJobPaths, ProcessingWorkspace } from "../ports/processing-workspace.js";
import type { VideoProbeResult, VideoProcessor } from "../ports/video-processor.js";
import { ActiveProcessingJobError } from "./active-processing-job-error.js";
import { needsH264Conversion } from "./needs-h264-conversion.js";
import {
  createProcessingJob,
  transitionProcessingJob,
  type ProcessingJob,
} from "./processing-job.js";

export interface ProcessVideoJobInput {
  inputPath: string;
  originalName: string;
  jobId?: string;
}

export type ProcessVideoJobProgressEvent =
  | { step: "probe"; outcome: "ok"; probe: VideoProbeResult }
  | { step: "processing"; outcome: "detected"; videoCodec: string | null; converted: boolean }
  | { step: "processing"; outcome: "converting" }
  | { step: "processing"; outcome: "skipped" }
  | { step: "processing"; outcome: "ok" }
  | { step: "generating_thumbnail"; outcome: "ok" }
  | { step: "finalizing"; outcome: "ok" };

export interface ProcessVideoJobSuccess {
  status: "completed";
  jobId: string;
  originalName: string;
  converted: boolean;
  probe: VideoProbeResult;
  outputVideoPath: string;
  thumbnailPath: string;
  workspaceDirectory: string;
  job: ProcessingJob;
}

export interface ProcessVideoJobFailure {
  status: "failed";
  jobId: string;
  originalName: string;
  error: string;
  job: ProcessingJob;
}

export type ProcessVideoJobResult = ProcessVideoJobSuccess | ProcessVideoJobFailure;

export interface StartedProcessingJob {
  job: ProcessingJob;
  paths: ProcessingJobPaths;
}

/**
 * Orchestrates one processing job: stage a copy, probe, convert HEVC, thumbnail.
 * Does not write to LIBRARY_PATH or SQLite. On success the workspace is kept for M5.
 */
export class ProcessVideoJobUseCase {
  constructor(
    private readonly processor: VideoProcessor,
    private readonly workspace: ProcessingWorkspace,
    private readonly jobs: ProcessingJobStore,
  ) {}

  async begin(input: { originalName: string; jobId?: string }): Promise<StartedProcessingJob> {
    const originalName = input.originalName.trim();

    if (originalName.length === 0) {
      throw new Error("Processing job original name must not be empty");
    }

    const active = this.jobs.findActive();

    if (active !== null) {
      throw new ActiveProcessingJobError(active.id);
    }

    let job = createProcessingJob({ originalName, id: input.jobId });
    this.jobs.create(job);
    job = this.save(transitionProcessingJob(job, { status: "uploading" }));
    const paths = await this.workspace.prepareJob(job.id);

    return { job, paths };
  }

  async execute(
    input: ProcessVideoJobInput,
    options?: { onProgress?: (event: ProcessVideoJobProgressEvent) => void },
  ): Promise<ProcessVideoJobResult> {
    if (input.inputPath.trim().length === 0) {
      throw new Error("Processing job input path must not be empty");
    }

    const started = await this.begin({ originalName: input.originalName, jobId: input.jobId });

    try {
      await this.workspace.stageSource(started.job.id, input.inputPath);
      return await this.processStaged(started.job.id, options);
    } catch (error: unknown) {
      return this.failStartedJob(started.job, error);
    }
  }

  async processStaged(
    jobId: string,
    options?: { onProgress?: (event: ProcessVideoJobProgressEvent) => void },
  ): Promise<ProcessVideoJobResult> {
    let job = this.requireJob(jobId);

    try {
      const paths = await this.workspace.prepareJob(job.id);

      job = this.save(transitionProcessingJob(job, { status: "processing", phase: "processing" }));
      const probe = await this.processor.probe(paths.sourcePath);
      options?.onProgress?.({ step: "probe", outcome: "ok", probe });

      const converted = needsH264Conversion(probe.videoCodec);
      job = this.save({ ...job, converted });
      options?.onProgress?.({
        step: "processing",
        outcome: "detected",
        videoCodec: probe.videoCodec,
        converted,
      });

      if (converted) {
        options?.onProgress?.({ step: "processing", outcome: "converting" });
        await this.processor.convert(paths.sourcePath, paths.convertedPath);
      } else {
        options?.onProgress?.({ step: "processing", outcome: "skipped" });
      }

      options?.onProgress?.({ step: "processing", outcome: "ok" });
      const outputVideoPath = converted ? paths.convertedPath : paths.sourcePath;

      job = this.save(transitionProcessingJob(job, { status: "processing", phase: "generating_thumbnail" }));
      await this.processor.generateThumbnail(outputVideoPath, paths.thumbnailPath);
      options?.onProgress?.({ step: "generating_thumbnail", outcome: "ok" });

      job = this.save(transitionProcessingJob(job, { status: "processing", phase: "finalizing" }));
      options?.onProgress?.({ step: "finalizing", outcome: "ok" });
      job = this.save(transitionProcessingJob(job, { status: "completed", videoId: job.originalName }));

      return {
        status: "completed",
        jobId: job.id,
        originalName: job.originalName,
        converted,
        probe,
        outputVideoPath,
        thumbnailPath: paths.thumbnailPath,
        workspaceDirectory: paths.directory,
        job,
      };
    } catch (error: unknown) {
      return this.failStartedJob(job, error);
    }
  }

  async failActiveJob(jobId: string, error: string): Promise<void> {
    const job = this.jobs.findById(jobId);

    if (job === null) {
      return;
    }

    await this.failStartedJob(job, error);
  }

  private async failStartedJob(job: ProcessingJob, error: unknown): Promise<ProcessVideoJobFailure> {
    const message = error instanceof Error ? error.message : String(error);
    const failed = this.markFailed(job, message);
    await this.discardWorkspace(job.id);

    return {
      status: "failed",
      jobId: failed.id,
      originalName: failed.originalName,
      error: message,
      job: failed,
    };
  }

  private requireJob(jobId: string): ProcessingJob {
    const job = this.jobs.findById(jobId);

    if (job === null) {
      throw new Error(`Processing job not found: ${jobId}`);
    }

    return job;
  }

  private save(job: ProcessingJob): ProcessingJob {
    this.jobs.update(job);
    return job;
  }

  private markFailed(job: ProcessingJob, error: string): ProcessingJob {
    if (job.state.status === "failed" || job.state.status === "completed") {
      return job;
    }

    return this.save(transitionProcessingJob(job, { status: "failed", error }));
  }

  private async discardWorkspace(jobId: string): Promise<void> {
    try {
      await this.workspace.discardJob(jobId);
    } catch {
      // The job is already failed; a leftover temp directory must not hide that.
    }
  }
}

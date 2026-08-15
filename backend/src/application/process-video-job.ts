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

/**
 * Orchestrates one processing job: stage a copy, probe, convert HEVC, thumbnail.
 * Does not write to LIBRARY_PATH or SQLite. On success the workspace is kept for M4/M5.
 */
export class ProcessVideoJobUseCase {
  constructor(
    private readonly processor: VideoProcessor,
    private readonly workspace: ProcessingWorkspace,
    private readonly jobs: ProcessingJobStore,
  ) {}

  async execute(
    input: ProcessVideoJobInput,
    options?: { onProgress?: (event: ProcessVideoJobProgressEvent) => void },
  ): Promise<ProcessVideoJobResult> {
    const originalName = input.originalName.trim();

    if (originalName.length === 0) {
      throw new Error("Processing job original name must not be empty");
    }

    if (input.inputPath.trim().length === 0) {
      throw new Error("Processing job input path must not be empty");
    }

    const active = this.jobs.findActive();

    if (active !== null) {
      throw new ActiveProcessingJobError(active.id);
    }

    let job = createProcessingJob({ originalName, id: input.jobId });
    this.jobs.create(job);

    try {
      job = this.save(transitionProcessingJob(job, { status: "uploading" }));
      const paths = await this.workspace.prepareJob(job.id);
      await this.workspace.stageSource(job.id, input.inputPath);

      job = this.save(transitionProcessingJob(job, { status: "processing", phase: "processing" }));
      const probe = await this.processor.probe(paths.sourcePath);
      options?.onProgress?.({ step: "probe", outcome: "ok", probe });

      const converted = needsH264Conversion(probe.videoCodec);
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
      job = this.save(transitionProcessingJob(job, { status: "completed", videoId: originalName }));

      return {
        status: "completed",
        jobId: job.id,
        originalName,
        converted,
        probe,
        outputVideoPath,
        thumbnailPath: paths.thumbnailPath,
        workspaceDirectory: paths.directory,
        job,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      job = this.failJob(job, message);
      await this.discardWorkspace(job.id);

      return {
        status: "failed",
        jobId: job.id,
        originalName,
        error: message,
        job,
      };
    }
  }

  private save(job: ProcessingJob): ProcessingJob {
    this.jobs.update(job);
    return job;
  }

  private failJob(job: ProcessingJob, error: string): ProcessingJob {
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

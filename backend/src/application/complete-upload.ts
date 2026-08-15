import type { ProcessStagedResult, ProcessVideoJobUseCase } from "./process-video-job.js";
import type { InstallProcessedUploadUseCase } from "./install-processed-upload.js";
import type { ProcessingJob } from "./processing-job.js";

export interface CompleteUploadSuccess {
  status: "completed";
  jobId: string;
  originalName: string;
  videoId: string;
  converted: boolean;
  installed: true;
  job: ProcessingJob;
}

export interface CompleteUploadFailure {
  status: "failed";
  jobId: string;
  originalName: string;
  error: string;
  job: ProcessingJob;
  conflict: boolean;
  stage: "processing" | "installing";
}

export type CompleteUploadResult = CompleteUploadSuccess | CompleteUploadFailure;

/**
 * Runs M3 processing then installs the result into the library (M5).
 */
export class CompleteUploadUseCase {
  constructor(
    private readonly processVideoJob: ProcessVideoJobUseCase,
    private readonly installProcessedUpload: InstallProcessedUploadUseCase,
  ) {}

  async assertAvailable(videoId: string): Promise<void> {
    await this.installProcessedUpload.assertAvailable(videoId);
  }

  async execute(jobId: string): Promise<CompleteUploadResult> {
    const processed = await this.processVideoJob.processStaged(jobId);

    if (processed.status === "failed") {
      return toProcessingFailure(processed);
    }

    return this.installProcessedUpload.execute(processed);
  }
}

function toProcessingFailure(result: Extract<ProcessStagedResult, { status: "failed" }>): CompleteUploadFailure {
  return {
    status: "failed",
    jobId: result.jobId,
    originalName: result.originalName,
    error: result.error,
    job: result.job,
    conflict: false,
    stage: "processing",
  };
}

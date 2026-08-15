import type { ProcessingJob, ProcessingJobPhase, ProcessingJobStatus } from "../ports/processing-job-store.js";
import { clampConversionProgress } from "./conversion-progress.js";
import { processingJobPhase } from "./processing-job.js";

export interface UploadJobOutputs {
  source: "source";
  converted: "converted.mp4" | null;
  thumbnail: "thumbnail.jpg";
}

export interface UploadJobView {
  jobId: string;
  status: ProcessingJobStatus;
  phase: ProcessingJobPhase;
  videoId: string | null;
  converted: boolean | null;
  progress: number | null;
  outputs: UploadJobOutputs | null;
}

export function toUploadJobView(job: ProcessingJob): UploadJobView {
  const videoId = job.state.status === "completed" ? job.state.videoId : job.originalName;
  const showOutputs = job.state.status === "completed" || job.state.status === "processing";

  return {
    jobId: job.id,
    status: job.state.status,
    phase: processingJobPhase(job.state),
    videoId,
    converted: job.converted,
    progress: job.progress === null ? null : clampConversionProgress(job.progress),
    outputs: showOutputs
      ? {
          source: "source",
          converted: job.converted === true ? "converted.mp4" : null,
          thumbnail: "thumbnail.jpg",
        }
      : null,
  };
}

export const PUBLIC_PROCESSING_FAILED_MESSAGE = "Video processing failed.";
export const ACTIVE_UPLOAD_JOB_MESSAGE = "A video processing job is already active.";

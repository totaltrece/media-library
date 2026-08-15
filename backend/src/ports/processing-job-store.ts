export type ProcessingJobStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "completed"
  | "failed";

export type ProcessingJobPhase =
  | "idle"
  | "uploading"
  | "processing"
  | "generating_thumbnail"
  | "finalizing"
  | "installing"
  | "completed"
  | "failed";

export type ProcessingPhase =
  | "processing"
  | "generating_thumbnail"
  | "finalizing"
  | "installing";

export type ProcessingJobState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "processing"; phase: ProcessingPhase }
  | { status: "completed"; videoId: string }
  | { status: "failed"; error: string };

export interface ProcessingJob {
  id: string;
  originalName: string;
  createdAt: string;
  state: ProcessingJobState;
  /**
   * Whether HEVC conversion ran. `null` until processing has decided.
   */
  converted: boolean | null;
  /**
   * Conversion percent 0–100 while FFmpeg is converting. `null` when not applicable.
   */
  progress: number | null;
}

export interface ProcessingJobStore {
  create(job: ProcessingJob): void;
  findById(id: string): ProcessingJob | null;
  update(job: ProcessingJob): void;
  list(): ProcessingJob[];
  findActive(): ProcessingJob | null;
}

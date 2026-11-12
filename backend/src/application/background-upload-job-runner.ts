import { isActiveProcessingJob, oldestQueuedProcessingJob } from "./processing-job.js";
import type { CompleteUploadUseCase } from "./complete-upload.js";
import type { ProcessVideoJobUseCase } from "./process-video-job.js";
import type { ProcessingJobStore } from "../ports/processing-job-store.js";

export type BackgroundUploadErrorLogger = (jobId: string, error: unknown) => void;

const defaultLogError: BackgroundUploadErrorLogger = (jobId, error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Upload job ${jobId} failed: ${message}`);
};

/**
 * Runs CompleteUploadUseCase after HTTP has accepted the file.
 * Failures are recorded on the job and never become unhandled rejections.
 */
export class BackgroundUploadJobRunner {
  private readonly inflight = new Map<string, Promise<void>>();

  constructor(
    private readonly completeUpload: CompleteUploadUseCase,
    private readonly processVideoJob: ProcessVideoJobUseCase,
    private readonly jobs: ProcessingJobStore,
    private readonly logError: BackgroundUploadErrorLogger = defaultLogError,
  ) {}

  start(jobId: string): void {
    if (this.inflight.has(jobId)) {
      return;
    }

    const running = this.run(jobId);
    this.inflight.set(jobId, running);
    void running.finally(() => {
      if (this.inflight.get(jobId) === running) {
        this.inflight.delete(jobId);
      }

      this.promoteNext();
    });
  }

  /** Starts the next stored upload when the worker is idle. */
  kick(): void {
    this.promoteNext();
  }

  waitFor(jobId: string): Promise<void> {
    return this.inflight.get(jobId) ?? Promise.resolve();
  }

  async waitForIdle(): Promise<void> {
    await Promise.all([...this.inflight.values()]);
  }

  private promoteNext(): void {
    if (this.inflight.size > 0 || this.jobs.findActive() !== null) {
      return;
    }

    const next = oldestQueuedProcessingJob(this.jobs.list());

    if (next === null) {
      return;
    }

    try {
      this.processVideoJob.promoteQueued(next.id);
    } catch (error: unknown) {
      this.logError(next.id, error);
      return;
    }

    this.start(next.id);
  }

  private async run(jobId: string): Promise<void> {
    try {
      const result = await this.completeUpload.execute(jobId);

      if (result.status === "failed") {
        this.logError(jobId, result.error);
      }
    } catch (error: unknown) {
      this.logError(jobId, error);
      await this.failIfActive(jobId, error);
    }
  }

  private async failIfActive(jobId: string, error: unknown): Promise<void> {
    try {
      const job = this.jobs.findById(jobId);

      if (job === null || !isActiveProcessingJob(job)) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);
      await this.processVideoJob.failActiveJob(jobId, message);
    } catch (failError: unknown) {
      this.logError(jobId, failError);
    }
  }
}

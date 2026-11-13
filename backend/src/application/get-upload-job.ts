import type { ProcessingJobStore } from "../ports/processing-job-store.js";
import { isActiveProcessingJob } from "./processing-job.js";
import { toUploadJobView, type UploadJobView } from "./to-upload-job-view.js";

export class GetUploadJobUseCase {
  constructor(private readonly jobs: ProcessingJobStore) {}

  execute(jobId: string): UploadJobView | null {
    const job = this.jobs.findById(jobId);

    if (job === null) {
      return null;
    }

    return toUploadJobView(job);
  }

  executeActive(): UploadJobView | null {
    const job = this.jobs.findActive();

    if (job === null) {
      return null;
    }

    return toUploadJobView(job);
  }

  executeOpen(): UploadJobView[] {
    return this.jobs.list()
      .filter((job) => isActiveProcessingJob(job) || job.state.status === "queued")
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
      .map((job) => toUploadJobView(job));
  }
}

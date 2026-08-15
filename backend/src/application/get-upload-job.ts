import type { ProcessingJobStore } from "../ports/processing-job-store.js";
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
}

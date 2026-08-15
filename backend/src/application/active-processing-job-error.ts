export class ActiveProcessingJobError extends Error {
  readonly jobId: string;

  constructor(jobId: string) {
    super(`A processing job is already active: ${jobId}`);
    this.name = "ActiveProcessingJobError";
    this.jobId = jobId;
  }
}

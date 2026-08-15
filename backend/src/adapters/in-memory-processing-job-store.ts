import { isActiveProcessingJob } from "../application/processing-job.js";
import type { ProcessingJob, ProcessingJobStore } from "../ports/processing-job-store.js";

export class InMemoryProcessingJobStore implements ProcessingJobStore {
  private readonly jobs = new Map<string, ProcessingJob>();

  create(job: ProcessingJob): void {
    if (this.jobs.has(job.id)) {
      throw new Error(`Processing job already exists: ${job.id}`);
    }

    this.jobs.set(job.id, job);
  }

  findById(id: string): ProcessingJob | null {
    return this.jobs.get(id) ?? null;
  }

  update(job: ProcessingJob): void {
    if (!this.jobs.has(job.id)) {
      throw new Error(`Processing job not found: ${job.id}`);
    }

    this.jobs.set(job.id, job);
  }

  list(): ProcessingJob[] {
    return [...this.jobs.values()];
  }

  findActive(): ProcessingJob | null {
    return this.list().find((job) => isActiveProcessingJob(job)) ?? null;
  }
}

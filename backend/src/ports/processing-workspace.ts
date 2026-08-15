export interface ProcessingJobPaths {
  directory: string;
  sourcePath: string;
  convertedPath: string;
  thumbnailPath: string;
}

/**
 * Temporary workspace for an upload/processing job.
 * Existing VideoStore and ThumbnailStore remain read-only catalog access.
 */
export interface ProcessingWorkspace {
  prepareJob(jobId: string): Promise<ProcessingJobPaths>;
  discardJob(jobId: string): Promise<void>;
}

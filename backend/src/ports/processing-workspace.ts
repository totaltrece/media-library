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
  /**
   * Copies the input video into the job workspace as `sourcePath`.
   * Must not modify or delete the original file.
   */
  stageSource(jobId: string, inputPath: string): Promise<ProcessingJobPaths>;
  discardJob(jobId: string): Promise<void>;
}

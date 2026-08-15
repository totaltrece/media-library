import { join } from "node:path";

import type { ProcessingJobPaths } from "../ports/processing-workspace.js";

const SAFE_JOB_ID = /^[A-Za-z0-9_-]+$/;

export function buildProcessingJobPaths(tempRoot: string, jobId: string): ProcessingJobPaths {
  if (tempRoot.length === 0) {
    throw new Error("Processing temp root must not be empty");
  }

  if (!SAFE_JOB_ID.test(jobId)) {
    throw new Error("Invalid processing job id");
  }

  const directory = join(tempRoot, jobId);

  return {
    directory,
    sourcePath: join(directory, "source"),
    convertedPath: join(directory, "converted.mp4"),
    thumbnailPath: join(directory, "thumbnail.jpg"),
  };
}

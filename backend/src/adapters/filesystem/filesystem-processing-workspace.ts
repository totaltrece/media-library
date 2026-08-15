import { copyFile, mkdir, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import { buildProcessingJobPaths } from "../../application/processing-job-paths.js";
import type { ProcessingJobPaths, ProcessingWorkspace } from "../../ports/processing-workspace.js";

/**
 * Temporary job directories under the configured upload temp root.
 * Never writes to or deletes from LIBRARY_PATH.
 */
export class FilesystemProcessingWorkspace implements ProcessingWorkspace {
  constructor(private readonly tempRoot: string) {}

  async prepareJob(jobId: string): Promise<ProcessingJobPaths> {
    const paths = this.pathsFor(jobId);
    await mkdir(paths.directory, { recursive: true });
    return paths;
  }

  async stageSource(jobId: string, inputPath: string): Promise<ProcessingJobPaths> {
    const paths = await this.prepareJob(jobId);
    const resolvedInput = resolve(inputPath);
    const resolvedSource = resolve(paths.sourcePath);

    if (resolvedInput !== resolvedSource) {
      await copyFile(resolvedInput, resolvedSource);
    }

    return paths;
  }

  async discardJob(jobId: string): Promise<void> {
    const paths = this.pathsFor(jobId);
    await rm(paths.directory, { recursive: true, force: true });
  }

  private pathsFor(jobId: string): ProcessingJobPaths {
    const paths = buildProcessingJobPaths(this.tempRoot, jobId);

    if (!isPathInsideRoot(this.tempRoot, paths.directory)) {
      throw new Error("Processing job directory must stay under the upload temp root");
    }

    return paths;
  }
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  const relativePath = relative(resolve(root), resolve(candidate));

  return relativePath !== "" && !relativePath.startsWith("..") && !isAbsolute(relativePath);
}

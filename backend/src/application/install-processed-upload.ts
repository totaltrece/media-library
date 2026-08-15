import type { LibraryMediaInstaller } from "../ports/library-media-installer.js";
import type { LibraryStore } from "../ports/library-store.js";
import type { ProcessingJobStore } from "../ports/processing-job-store.js";
import type { MutableVideoIndex } from "../ports/video-index.js";

import { transitionProcessingJob, type ProcessingJob } from "./processing-job.js";
import type { ProcessedVideoJob } from "./process-video-job.js";
import { toStoredRecordedAt } from "./resolve-canonical-upload-name.js";
import { reloadVideoIndex } from "./reload-video-index.js";
import {
  PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE,
  VideoAlreadyExistsError,
} from "./video-already-exists-error.js";

export const PUBLIC_INSTALLATION_FAILED_MESSAGE = "The video could not be installed.";

export interface InstallProcessedUploadSuccess {
  status: "completed";
  jobId: string;
  originalName: string;
  videoId: string;
  converted: boolean;
  installed: true;
  job: ProcessingJob;
}

export interface InstallProcessedUploadFailure {
  status: "failed";
  jobId: string;
  originalName: string;
  error: string;
  job: ProcessingJob;
  conflict: boolean;
  stage: "installing";
}

export type InstallProcessedUploadResult =
  | InstallProcessedUploadSuccess
  | InstallProcessedUploadFailure;

/**
 * Installs a processed job into LIBRARY_PATH, registers SQLite, and reloads
 * the in-memory index. Does not overwrite existing media.
 */
export class InstallProcessedUploadUseCase {
  constructor(
    private readonly installer: LibraryMediaInstaller,
    private readonly libraryStore: LibraryStore,
    private readonly videoIndex: MutableVideoIndex,
    private readonly jobs: ProcessingJobStore,
    private readonly libraryPath: string,
  ) {}

  async assertAvailable(videoId: string): Promise<void> {
    if (this.libraryStore.findVideo(videoId) !== null) {
      throw new VideoAlreadyExistsError(videoId);
    }

    const presence = await this.installer.exists(videoId);

    if (presence.video || presence.thumbnail) {
      throw new VideoAlreadyExistsError(videoId);
    }
  }

  async execute(processed: ProcessedVideoJob): Promise<InstallProcessedUploadResult> {
    let job = this.requireJob(processed.jobId);
    const videoId = processed.originalName;
    let createdVideo = false;
    let createdThumbnail = false;

    try {
      job = this.save(transitionProcessingJob(job, { status: "processing", phase: "installing" }));
      await this.assertAvailable(videoId);

      try {
        await this.installer.installVideo(processed.outputVideoPath, videoId);
        createdVideo = true;
        await this.installer.installThumbnail(processed.thumbnailPath, videoId);
        createdThumbnail = true;
      } catch (error: unknown) {
        await this.compensate(videoId, createdVideo, createdThumbnail);
        throw toInstallError(error, videoId);
      }

      try {
        this.libraryStore.upsertVideo(videoId, toStoredRecordedAt(processed.probe.recordingTime));
      } catch (error: unknown) {
        await this.compensate(videoId, createdVideo, createdThumbnail);
        throw error;
      }

      reloadVideoIndex(this.libraryStore, this.videoIndex, this.libraryPath);

      job = this.save(transitionProcessingJob(job, { status: "completed", videoId }));

      return {
        status: "completed",
        jobId: job.id,
        originalName: job.originalName,
        videoId,
        converted: processed.converted,
        installed: true,
        job,
      };
    } catch (error: unknown) {
      const conflict = error instanceof VideoAlreadyExistsError;
      const failed = this.markFailed(job, conflict ? PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE : toErrorMessage(error));

      return {
        status: "failed",
        jobId: failed.id,
        originalName: failed.originalName,
        error: failed.state.status === "failed" ? failed.state.error : toErrorMessage(error),
        job: failed,
        conflict,
        stage: "installing",
      };
    }
  }

  private async compensate(
    videoId: string,
    createdVideo: boolean,
    createdThumbnail: boolean,
  ): Promise<void> {
    const failures: string[] = [];

    if (createdThumbnail) {
      try {
        await this.installer.removeThumbnail(videoId);
      } catch (error: unknown) {
        failures.push(`thumbnail: ${toErrorMessage(error)}`);
      }
    }

    if (createdVideo) {
      try {
        await this.installer.removeVideo(videoId);
      } catch (error: unknown) {
        failures.push(`video: ${toErrorMessage(error)}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Installation compensation failed (${failures.join("; ")})`);
    }
  }

  private requireJob(jobId: string): ProcessingJob {
    const job = this.jobs.findById(jobId);

    if (job === null) {
      throw new Error(`Processing job not found: ${jobId}`);
    }

    return job;
  }

  private save(job: ProcessingJob): ProcessingJob {
    this.jobs.update(job);
    return job;
  }

  private markFailed(job: ProcessingJob, error: string): ProcessingJob {
    if (job.state.status === "failed" || job.state.status === "completed") {
      return job;
    }

    return this.save(transitionProcessingJob(job, { status: "failed", error }));
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toInstallError(error: unknown, videoId: string): unknown {
  if (error instanceof VideoAlreadyExistsError) {
    return error;
  }

  if (isAlreadyExistsError(error)) {
    return new VideoAlreadyExistsError(videoId);
  }

  return error;
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST";
}

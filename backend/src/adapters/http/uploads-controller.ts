import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";

import { ActiveProcessingJobError } from "../../application/active-processing-job-error.js";
import type { BackgroundUploadJobRunner } from "../../application/background-upload-job-runner.js";
import type { CompleteUploadUseCase } from "../../application/complete-upload.js";
import type { GetUploadJobUseCase } from "../../application/get-upload-job.js";
import type { ProcessVideoJobUseCase } from "../../application/process-video-job.js";
import {
  InvalidUploadFileNameError,
  isAllowedUploadContentType,
  sanitizeUploadFileName,
} from "../../application/sanitize-upload-file-name.js";
import {
  ACTIVE_UPLOAD_JOB_MESSAGE,
  PUBLIC_PROCESSING_FAILED_MESSAGE,
} from "../../application/to-upload-job-view.js";
import {
  PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE,
  VideoAlreadyExistsError,
} from "../../application/video-already-exists-error.js";

export interface UploadsControllerOptions {
  processVideoJobUseCase: ProcessVideoJobUseCase;
  completeUploadUseCase: CompleteUploadUseCase;
  backgroundUploadJobRunner: BackgroundUploadJobRunner;
  getUploadJobUseCase: GetUploadJobUseCase;
  uploadMaxBytes: number;
}

export async function registerUploadsRoutes(
  app: FastifyInstance,
  options: UploadsControllerOptions,
): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: options.uploadMaxBytes,
      files: 1,
      fields: 4,
      parts: 6,
    },
    throwFileSizeLimit: true,
  });

  app.post("/admin/uploads", async (request, reply) => {
    return handleUpload(request, reply, options);
  });

  app.get("/admin/uploads/active", async (_request, reply) => {
    const job = options.getUploadJobUseCase.executeActive();

    if (job === null) {
      return reply.status(404).send({
        error: {
          message: "No active upload job.",
        },
      });
    }

    if (job.status === "failed") {
      return reply.status(200).send({
        ...job,
        error: {
          message: PUBLIC_PROCESSING_FAILED_MESSAGE,
        },
      });
    }

    return job;
  });

  app.get("/admin/uploads/:jobId", async (request, reply) => {
    const jobId = (request.params as { jobId?: string }).jobId?.trim() ?? "";

    if (jobId.length === 0) {
      return reply.status(400).send({
        error: {
          message: "Job id is required",
        },
      });
    }

    const job = options.getUploadJobUseCase.execute(jobId);

    if (job === null) {
      return reply.status(404).send({
        error: {
          message: "Upload job not found",
        },
      });
    }

    if (job.status === "failed") {
      return reply.status(200).send({
        ...job,
        error: {
          message: PUBLIC_PROCESSING_FAILED_MESSAGE,
        },
      });
    }

    return job;
  });
}

async function handleUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  options: UploadsControllerOptions,
): Promise<FastifyReply | Record<string, unknown>> {
  let jobId: string | undefined;

  try {
    if (!request.isMultipart()) {
      return reply.status(400).send({
        error: {
          message: "A video file is required.",
        },
      });
    }

    let storedFile = false;

    for await (const part of request.parts()) {
      if (part.type !== "file") {
        continue;
      }

      if (storedFile || part.fieldname !== "video") {
        part.file.resume();
        if (jobId !== undefined) {
          await options.processVideoJobUseCase.failActiveJob(jobId, "Exactly one video file is required.");
        }
        return reply.status(400).send({
          error: {
            message: "Exactly one video file is required.",
          },
        });
      }

      if (!isAllowedUploadContentType(part.mimetype)) {
        part.file.resume();
        return reply.status(400).send({
          error: {
            message: "The uploaded video type is not supported.",
          },
        });
      }

      let originalName: string;

      try {
        originalName = sanitizeUploadFileName(part.filename);
      } catch (error: unknown) {
        part.file.resume();
        const message = error instanceof InvalidUploadFileNameError
          ? error.message
          : "The uploaded video file name is invalid.";
        return reply.status(400).send({
          error: {
            message,
          },
        });
      }

      try {
        await options.completeUploadUseCase.assertAvailable(originalName);
      } catch (error: unknown) {
        part.file.resume();
        throw error;
      }

      const started = await options.processVideoJobUseCase.begin({ originalName });
      jobId = started.job.id;
      await pipeline(part.file, createWriteStream(started.paths.sourcePath));
      storedFile = true;
    }

    if (!storedFile || jobId === undefined) {
      return reply.status(400).send({
        error: {
          message: "A video file is required.",
        },
      });
    }

    options.backgroundUploadJobRunner.start(jobId);

    return reply.status(202).send({
      jobId,
      status: "uploading",
    });
  } catch (error: unknown) {
    if (error instanceof VideoAlreadyExistsError) {
      return reply.status(409).send({
        error: {
          message: PUBLIC_VIDEO_ALREADY_EXISTS_MESSAGE,
        },
      });
    }

    if (error instanceof ActiveProcessingJobError) {
      return reply.status(409).send({
        error: {
          message: ACTIVE_UPLOAD_JOB_MESSAGE,
        },
        jobId: error.jobId,
      });
    }

    if (isFileTooLargeError(error)) {
      if (jobId !== undefined) {
        await options.processVideoJobUseCase.failActiveJob(jobId, "The uploaded video exceeds the size limit.");
      }
      return reply.status(413).send({
        error: {
          message: "The uploaded video exceeds the size limit.",
        },
      });
    }

    if (jobId !== undefined) {
      await options.processVideoJobUseCase.failActiveJob(jobId, PUBLIC_PROCESSING_FAILED_MESSAGE);
    }

    return reply.status(500).send({
      ...(jobId === undefined ? {} : { jobId, status: "failed" }),
      error: {
        message: isMultipartError(error) ? "A video file is required." : PUBLIC_PROCESSING_FAILED_MESSAGE,
      },
    });
  }
}

function isFileTooLargeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const statusCode = "statusCode" in error ? error.statusCode : undefined;

  return code === "FST_REQ_FILE_TOO_LARGE" || statusCode === 413;
}

function isMultipartError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return false;
  }

  return typeof error.code === "string" && error.code.startsWith("FST_INVALID_MULTIPART");
}

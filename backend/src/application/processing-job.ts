import { randomUUID } from "node:crypto";

import type {
  ProcessingJob,
  ProcessingJobPhase,
  ProcessingJobState,
  ProcessingPhase,
} from "../ports/processing-job-store.js";

export type {
  ProcessingJob,
  ProcessingJobPhase,
  ProcessingJobState,
  ProcessingJobStatus,
  ProcessingPhase,
} from "../ports/processing-job-store.js";

export class InvalidProcessingJobTransitionError extends Error {
  readonly from: ProcessingJobState;
  readonly to: ProcessingJobState;

  constructor(from: ProcessingJobState, to: ProcessingJobState) {
    super(`Invalid processing job transition: ${formatProcessingJobState(from)} -> ${formatProcessingJobState(to)}`);
    this.name = "InvalidProcessingJobTransitionError";
    this.from = from;
    this.to = to;
  }
}

export function createProcessingJob(input: {
  originalName: string;
  id?: string;
  createdAt?: string;
}): ProcessingJob {
  const originalName = input.originalName.trim();

  if (originalName.length === 0) {
    throw new Error("Processing job original name must not be empty");
  }

  return {
    id: input.id ?? randomUUID(),
    originalName,
    createdAt: input.createdAt ?? new Date().toISOString(),
    state: { status: "idle" },
    converted: null,
    progress: null,
  };
}

export function isActiveProcessingJob(job: ProcessingJob): boolean {
  return job.state.status === "uploading" || job.state.status === "processing";
}

export function isTerminalProcessingJob(job: ProcessingJob): boolean {
  return job.state.status === "completed" || job.state.status === "failed";
}

export function processingJobPhase(state: ProcessingJobState): ProcessingJobPhase {
  if (state.status === "processing") {
    return state.phase;
  }

  return state.status;
}

export function formatProcessingJobState(state: ProcessingJobState): string {
  if (state.status === "processing") {
    return `${state.status}:${state.phase}`;
  }

  return state.status;
}

export function transitionProcessingJob(job: ProcessingJob, next: ProcessingJobState): ProcessingJob {
  if (!canTransitionProcessingJob(job.state, next)) {
    throw new InvalidProcessingJobTransitionError(job.state, next);
  }

  return {
    ...job,
    state: next,
  };
}

export function canTransitionProcessingJob(from: ProcessingJobState, to: ProcessingJobState): boolean {
  const allowed = allowedTransitions(from);

  return allowed.some((candidate) => processingJobStatesEqual(candidate, to));
}

function allowedTransitions(from: ProcessingJobState): ProcessingJobState[] {
  switch (from.status) {
    case "idle":
      return [{ status: "uploading" }];
    case "uploading":
      return [{ status: "processing", phase: "processing" }, failedPlaceholder];
    case "processing":
      return nextProcessingTransitions(from.phase);
    case "completed":
    case "failed":
      return [];
  }
}

function nextProcessingTransitions(phase: ProcessingPhase): ProcessingJobState[] {
  switch (phase) {
    case "processing":
      return [{ status: "processing", phase: "generating_thumbnail" }, failedPlaceholder];
    case "generating_thumbnail":
      return [{ status: "processing", phase: "finalizing" }, failedPlaceholder];
    case "finalizing":
      return [
        { status: "processing", phase: "installing" },
        { status: "completed", videoId: "*" },
        failedPlaceholder,
      ];
    case "installing":
      return [{ status: "completed", videoId: "*" }, failedPlaceholder];
  }
}

const failedPlaceholder: ProcessingJobState = { status: "failed", error: "*" };

function processingJobStatesEqual(left: ProcessingJobState, right: ProcessingJobState): boolean {
  if (left.status !== right.status) {
    return false;
  }

  if (left.status === "processing" && right.status === "processing") {
    return left.phase === right.phase;
  }

  if (left.status === "completed" && right.status === "completed") {
    return left.videoId === "*" || right.videoId === "*" || left.videoId === right.videoId;
  }

  return true;
}

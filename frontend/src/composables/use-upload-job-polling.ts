import { onUnmounted, ref } from "vue";

import { ApiRequestError, fetchActiveUploadJob, fetchOpenUploadJobs, fetchUploadJob } from "../api/client.js";
import type { UploadJobView } from "../api/types.js";
import {
  isUploadJobActive,
  isUploadJobQueued,
  mapUploadError,
  pollingWarningMessage,
  UPLOAD_POLL_INTERVAL_MS,
} from "../utils/upload-job.js";

const PENDING_JOB_ID = "pending";

export function useUploadJobPolling() {
  const job = ref<UploadJobView | null>(null);
  const queued = ref<UploadJobView[]>([]);
  const pollWarning = ref<string | null>(null);
  let jobId: string | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;
  let generation = 0;
  let resumeInFlight: Promise<boolean> | null = null;

  async function pollOnce(expectedGeneration: number): Promise<void> {
    if (expectedGeneration !== generation || jobId === null || jobId === PENDING_JOB_ID || inFlight) {
      return;
    }

    const requestedId = jobId;
    inFlight = true;

    try {
      const next = await fetchUploadJob(requestedId);

      if (expectedGeneration !== generation || jobId !== requestedId) {
        return;
      }

      job.value = next;
      pollWarning.value = null;

      if (next.status === "completed" || next.status === "failed") {
        stop();
        void advanceQueue(expectedGeneration);
      }
    } catch (error: unknown) {
      if (expectedGeneration !== generation) {
        return;
      }

      if (error instanceof ApiRequestError && error.status === 404) {
        pollWarning.value = mapUploadError(error);
        job.value = null;
        queued.value = [];
        stop();
      } else {
        pollWarning.value = pollingWarningMessage();
      }
    } finally {
      if (expectedGeneration === generation) {
        inFlight = false;
      }
    }
  }

  async function advanceQueue(finishedGeneration: number): Promise<void> {
    let open: UploadJobView[] | null = null;

    try {
      open = await fetchOpenUploadJobs();
    } catch {
      open = null;
    }

    if (finishedGeneration !== generation) {
      return;
    }

    if (open === null) {
      const next = queued.value[0];

      if (next !== undefined) {
        queued.value = queued.value.slice(1);
        start(next.jobId, {
          ...next,
          status: "uploading",
          phase: "uploading",
        });
      }

      return;
    }

    const active = open.find((item) => isUploadJobActive(item)) ?? null;
    queued.value = open.filter((item) => isUploadJobQueued(item));

    if (active !== null) {
      start(active.jobId, active);
      return;
    }

    if (queued.value.length > 0) {
      watchOpenQueue();
    }
  }

  async function pollOpen(expectedGeneration: number): Promise<void> {
    if (expectedGeneration !== generation || inFlight) {
      return;
    }

    inFlight = true;

    try {
      const open = await fetchOpenUploadJobs();

      if (expectedGeneration !== generation) {
        return;
      }

      pollWarning.value = null;
      const active = open.find((item) => isUploadJobActive(item)) ?? null;
      queued.value = open.filter((item) => isUploadJobQueued(item));

      if (active !== null) {
        start(active.jobId, active);
        return;
      }

      if (queued.value.length === 0) {
        stop();
      }
    } catch {
      if (expectedGeneration === generation) {
        pollWarning.value = pollingWarningMessage();
      }
    } finally {
      if (expectedGeneration === generation) {
        inFlight = false;
      }
    }
  }

  function watchOpenQueue(): void {
    stop();
    inFlight = false;
    generation += 1;
    const currentGeneration = generation;
    void pollOpen(currentGeneration);
    timer = setInterval(() => {
      void pollOpen(currentGeneration);
    }, UPLOAD_POLL_INTERVAL_MS);
  }

  function start(nextJobId: string, initialJob?: UploadJobView): void {
    stop();
    inFlight = false;
    generation += 1;
    const currentGeneration = generation;
    jobId = nextJobId;
    job.value = initialJob ?? {
      jobId: nextJobId,
      status: "uploading",
      phase: "uploading",
      videoId: null,
      converted: null,
      progress: null,
      outputs: null,
    };
    pollWarning.value = null;
    void pollOnce(currentGeneration);
    timer = setInterval(() => {
      void pollOnce(currentGeneration);
    }, UPLOAD_POLL_INTERVAL_MS);
  }

  function rememberQueued(jobs: UploadJobView[]): void {
    queued.value = jobs.filter((item) => isUploadJobQueued(item));
  }

  function beginLocalUpload(fileName: string): void {
    stop();
    inFlight = false;
    generation += 1;
    jobId = PENDING_JOB_ID;
    queued.value = [];
    job.value = {
      jobId: PENDING_JOB_ID,
      status: "uploading",
      phase: "uploading",
      videoId: fileName,
      converted: null,
      progress: null,
      outputs: null,
    };
    pollWarning.value = null;
  }

  function stop(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function reset(): void {
    stop();
    generation += 1;
    inFlight = false;
    jobId = null;
    job.value = null;
    queued.value = [];
    pollWarning.value = null;
  }

  function hasActiveJob(): boolean {
    return isUploadJobActive(job.value) || isUploadJobQueued(job.value) || queued.value.length > 0;
  }

  async function resumeActive(): Promise<boolean> {
    if (resumeInFlight !== null) {
      return resumeInFlight;
    }

    resumeInFlight = (async () => {
      const expectedGeneration = generation;

      try {
        const active = await fetchActiveUploadJob();

        if (expectedGeneration !== generation) {
          return hasActiveJob();
        }

        if (active === null || !isUploadJobActive(active)) {
          return false;
        }

        try {
          const open = await fetchOpenUploadJobs();

          if (expectedGeneration === generation) {
            queued.value = open.filter((item) => isUploadJobQueued(item) && item.jobId !== active.jobId);
          }
        } catch {
          // The active job is still shown when the queue snapshot fails.
        }

        if (expectedGeneration !== generation) {
          return hasActiveJob();
        }

        start(active.jobId, active);
        return true;
      } catch {
        return hasActiveJob();
      }
    })();

    try {
      return await resumeInFlight;
    } finally {
      resumeInFlight = null;
    }
  }

  onUnmounted(() => {
    stop();
    generation += 1;
  });

  return {
    job,
    queued,
    pollWarning,
    start,
    rememberQueued,
    beginLocalUpload,
    stop,
    reset,
    resumeActive,
  };
}

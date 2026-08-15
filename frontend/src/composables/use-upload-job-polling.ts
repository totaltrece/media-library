import { onUnmounted, ref } from "vue";

import { ApiRequestError, fetchActiveUploadJob, fetchUploadJob } from "../api/client.js";
import type { UploadJobView } from "../api/types.js";
import { isUploadJobActive, pollingWarningMessage, UPLOAD_POLL_INTERVAL_MS } from "../utils/upload-job.js";

const PENDING_JOB_ID = "pending";

export function useUploadJobPolling() {
  const job = ref<UploadJobView | null>(null);
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
      }
    } catch (error: unknown) {
      if (expectedGeneration !== generation) {
        return;
      }

      if (error instanceof ApiRequestError && error.status === 404) {
        pollWarning.value = "No se ha encontrado el estado de la subida.";
        job.value = null;
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

  function beginLocalUpload(fileName: string): void {
    stop();
    inFlight = false;
    generation += 1;
    jobId = PENDING_JOB_ID;
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
    pollWarning.value = null;
  }

  function hasActiveJob(): boolean {
    return isUploadJobActive(job.value);
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
    pollWarning,
    start,
    beginLocalUpload,
    stop,
    reset,
    resumeActive,
  };
}

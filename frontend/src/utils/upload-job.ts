import { ApiRequestError } from "../api/client.js";
import type { UploadJobPhase, UploadJobStatus, UploadJobView } from "../api/types.js";

export const UPLOAD_POLL_INTERVAL_MS = 1000;

export type UploadStepId = "uploading" | "processing" | "generating_thumbnail" | "installing" | "completed";
export type UploadStepState = "pending" | "current" | "done" | "error";

export interface UploadStep {
  id: UploadStepId;
  label: string;
  state: UploadStepState;
}

const STEP_ORDER: UploadStepId[] = [
  "uploading",
  "processing",
  "generating_thumbnail",
  "installing",
  "completed",
];

const STEP_LABELS: Record<UploadStepId, string> = {
  uploading: "Subiendo vídeo",
  processing: "Procesando vídeo",
  generating_thumbnail: "Generando thumbnail",
  installing: "Instalando vídeo",
  completed: "Completado",
};

export function isUploadJobActive(job: Pick<UploadJobView, "status"> | null): boolean {
  return job?.status === "uploading" || job?.status === "processing";
}

export function currentUploadStepId(job: Pick<UploadJobView, "status" | "phase"> | null): UploadStepId | null {
  if (job === null) {
    return null;
  }

  if (job.status === "completed" || job.status === "failed") {
    return job.status === "completed" ? "completed" : resolveActiveStep(job.phase, job.status);
  }

  return resolveActiveStep(job.phase, job.status);
}

function resolveActiveStep(phase: UploadJobPhase, status: UploadJobStatus): UploadStepId {
  if (status === "uploading" || phase === "uploading") {
    return "uploading";
  }

  if (phase === "generating_thumbnail") {
    return "generating_thumbnail";
  }

  if (phase === "installing" || phase === "finalizing") {
    return "installing";
  }

  if (status === "completed" || phase === "completed") {
    return "completed";
  }

  return "processing";
}

export function buildUploadSteps(job: Pick<UploadJobView, "status" | "phase"> | null): UploadStep[] {
  const current = currentUploadStepId(job);
  const failed = job?.status === "failed";
  const currentIndex = current === null ? -1 : STEP_ORDER.indexOf(current);

  return STEP_ORDER.map((id, index) => {
    let state: UploadStepState = "pending";

    if (job === null) {
      state = "pending";
    } else if (failed && index === currentIndex) {
      state = "error";
    } else if (job.status === "completed" || index < currentIndex) {
      state = "done";
    } else if (index === currentIndex) {
      state = "current";
    }

    return {
      id,
      label: STEP_LABELS[id],
      state,
    };
  });
}

export function conversionProgressLabel(job: Pick<UploadJobView, "phase" | "progress"> | null): string | null {
  if (job?.phase !== "processing" || typeof job.progress !== "number") {
    return null;
  }

  return `${STEP_LABELS.processing} · ${job.progress}%`;
}

export function uploadStepLabel(step: UploadStep, job: Pick<UploadJobView, "phase" | "progress"> | null): string {
  if (step.id === "processing" && step.state === "current") {
    return conversionProgressLabel(job) ?? step.label;
  }

  return step.label;
}

export function showsConversionProgress(job: Pick<UploadJobView, "phase" | "progress"> | null): boolean {
  return conversionProgressLabel(job) !== null;
}

export function mapUploadError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 413) {
      return "El vídeo supera el tamaño máximo permitido.";
    }

    if (error.status === 409) {
      if (error.message.includes("already exists")) {
        return "Ya existe un vídeo con este nombre.";
      }

      return "Ya hay un vídeo en proceso.";
    }

    if (error.status === 404) {
      return "No se ha encontrado el estado de la subida.";
    }

    if (error.status === 400) {
      return "El vídeo seleccionado no es válido.";
    }

    if (error.status >= 500) {
      return "No se ha podido procesar el vídeo.";
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes("fetch")) {
    return "No se ha podido enviar el vídeo. Comprueba la conexión.";
  }

  return "No se ha podido enviar el vídeo. Comprueba la conexión.";
}

export function pollingWarningMessage(): string {
  return "No se puede consultar el estado. Se reintentará.";
}

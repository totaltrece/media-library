import { describe, expect, it } from "vitest";

import { ApiRequestError } from "../src/api/client.js";
import { buildUploadSteps, isUploadJobActive, mapUploadError } from "../src/utils/upload-job.js";
import type { UploadJobView } from "../src/api/types.js";

function job(partial: Partial<UploadJobView>): UploadJobView {
  return {
    jobId: "job-1",
    status: "uploading",
    phase: "uploading",
    videoId: "clip.mp4",
    converted: null,
    outputs: null,
    ...partial,
  };
}

describe("upload job presentation", () => {
  it("treats uploading and processing as active", () => {
    expect(isUploadJobActive(job({ status: "uploading" }))).toBe(true);
    expect(isUploadJobActive(job({ status: "processing", phase: "installing" }))).toBe(true);
    expect(isUploadJobActive(job({ status: "completed", phase: "completed" }))).toBe(false);
    expect(isUploadJobActive(job({ status: "failed", phase: "failed" }))).toBe(false);
  });

  it("highlights processing, thumbnail, and installing from status and phase", () => {
    expect(buildUploadSteps(job({ status: "processing", phase: "processing" })).map((step) => step.state)).toEqual([
      "done",
      "current",
      "pending",
      "pending",
      "pending",
    ]);
    expect(
      buildUploadSteps(job({ status: "processing", phase: "generating_thumbnail" })).find(
        (step) => step.id === "generating_thumbnail",
      )?.state,
    ).toBe("current");
    expect(
      buildUploadSteps(job({ status: "processing", phase: "installing" })).find((step) => step.id === "installing")
        ?.state,
    ).toBe("current");
    expect(buildUploadSteps(job({ status: "completed", phase: "completed" })).every((step) => step.state === "done")).toBe(
      true,
    );
  });

  it("maps API errors to safe user messages", () => {
    expect(mapUploadError(new ApiRequestError("A video processing job is already active.", 409))).toBe(
      "Ya hay un vídeo en proceso.",
    );
    expect(mapUploadError(new ApiRequestError("A video with this name already exists.", 409))).toBe(
      "Ya existe un vídeo con este nombre.",
    );
    expect(mapUploadError(new ApiRequestError("The uploaded video exceeds the size limit.", 413))).toBe(
      "El vídeo supera el tamaño máximo permitido.",
    );
    expect(mapUploadError(new ApiRequestError("Invalid video file.", 400))).toBe(
      "El vídeo seleccionado no es válido.",
    );
    expect(mapUploadError(new ApiRequestError("Video processing failed.", 500))).toBe(
      "No se ha podido procesar el vídeo.",
    );
    expect(mapUploadError(new TypeError("Failed to fetch"))).toBe(
      "No se ha podido enviar el vídeo. Comprueba la conexión.",
    );
  });
});

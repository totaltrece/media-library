<template>
  <section class="admin-upload" aria-label="Subir vídeo">
    <h2>Subir vídeo</h2>
    <p>El vídeo se procesará en el servidor y aparecerá en Sin tags cuando termine.</p>

    <input
      id="admin-upload-file"
      ref="fileInput"
      class="admin-upload-input"
      type="file"
      accept="video/*,.mp4,.m4v,.mov,.mkv,.webm,.ts"
      data-testid="upload-file-input"
      :disabled="busy"
      @change="onFileChange"
    >

    <p v-if="selectedFileName" class="admin-upload-filename" data-testid="upload-file-name">
      {{ selectedFileName }}
    </p>

    <div class="admin-upload-actions">
      <button
        class="secondary-button admin-upload-button"
        type="button"
        data-testid="upload-select"
        :disabled="busy"
        @click="openFilePicker"
      >
        Seleccionar vídeo
      </button>
      <button
        class="primary-button admin-upload-button"
        type="button"
        data-testid="upload-submit"
        :disabled="busy"
        @click="submitUpload"
      >
        Subir vídeo
      </button>
    </div>

    <p v-if="busy" class="status-message info" data-testid="upload-busy">
      Hay un vídeo en proceso. Espera a que termine para subir otro.
    </p>

    <ErrorMessage v-if="error" :message="error" />
    <p v-if="pollWarning" class="status-message info" data-testid="upload-poll-warning">
      {{ pollWarning }}
    </p>
    <p v-if="successMessage" class="status-message info" data-testid="upload-success">
      {{ successMessage }}
    </p>

    <ol v-if="job" class="admin-upload-steps" data-testid="upload-steps">
      <li
        v-for="step in steps"
        :key="step.id"
        :class="['admin-upload-step', `is-${step.state}`]"
        :data-step="step.id"
      >
        <span class="admin-upload-step-marker" aria-hidden="true">{{ stepMarker(step.state) }}</span>
        <span>{{ step.label }}</span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { ApiRequestError, uploadVideo } from "../api/client.js";
import { useUploadJobPolling } from "../composables/use-upload-job-polling.js";
import {
  buildUploadSteps,
  isUploadJobActive,
  mapUploadError,
} from "../utils/upload-job.js";
import type { UploadStepState } from "../utils/upload-job.js";
import ErrorMessage from "./ErrorMessage.vue";

const emit = defineEmits<{
  completed: [];
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const submitting = ref(false);
const { job, pollWarning, start, reset } = useUploadJobPolling();

const selectedFileName = computed(() => selectedFile.value?.name ?? "");
const busy = computed(() => submitting.value || isUploadJobActive(job.value));
const steps = computed(() => buildUploadSteps(job.value));

function openFilePicker(): void {
  fileInput.value?.click();
}

function onFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  selectedFile.value = input.files?.[0] ?? null;
  error.value = null;
  successMessage.value = null;
}

async function submitUpload(): Promise<void> {
  if (busy.value) {
    return;
  }

  if (selectedFile.value === null) {
    error.value = "Selecciona un vídeo primero.";
    return;
  }

  error.value = null;
  successMessage.value = null;
  submitting.value = true;

  try {
    const accepted = await uploadVideo(selectedFile.value);
    start(accepted.jobId, {
      jobId: accepted.jobId,
      status: accepted.status,
      phase: "uploading",
      videoId: null,
      converted: null,
      outputs: null,
    });
  } catch (uploadError: unknown) {
    error.value = mapUploadError(uploadError);

    if (uploadError instanceof ApiRequestError && uploadError.status === 409 && uploadError.jobId !== null) {
      start(uploadError.jobId);
    } else {
      reset();
    }
  } finally {
    submitting.value = false;
  }
}

function stepMarker(state: UploadStepState): string {
  if (state === "done") {
    return "✓";
  }

  if (state === "current") {
    return "●";
  }

  if (state === "error") {
    return "!";
  }

  return "○";
}

watch(
  () => job.value?.status,
  (status) => {
    if (status === "completed") {
      successMessage.value = "Vídeo añadido correctamente";
      emit("completed");
    }

    if (status === "failed") {
      error.value = "No se ha podido procesar el vídeo.";
      successMessage.value = null;
    }
  },
);
</script>

<style scoped>
.admin-upload {
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 1rem;
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding: 1rem;
}

.admin-upload h2 {
  font-size: 1.125rem;
  margin: 0;
}

.admin-upload > p {
  color: #5f6368;
  margin: 0;
}

.admin-upload-input {
  height: 0;
  opacity: 0;
  position: absolute;
  width: 0;
}

.admin-upload-filename {
  color: #202124;
  font-weight: 600;
  margin: 0;
  overflow-wrap: anywhere;
}

.admin-upload-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-upload-button {
  font-size: 1rem;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.75rem 1.25rem;
}

.admin-upload-steps {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
}

.admin-upload-step {
  align-items: flex-start;
  color: #80868b;
  display: flex;
  font-size: 1rem;
  gap: 0.5rem;
  line-height: 1.4;
}

.admin-upload-step.is-current {
  color: #174ea6;
  font-weight: 700;
}

.admin-upload-step.is-done {
  color: #137333;
}

.admin-upload-step.is-error {
  color: #a50e0e;
  font-weight: 700;
}

.admin-upload-step-marker {
  flex: 0 0 1.25rem;
  text-align: center;
}

@media (max-width: 599px) {
  .admin-upload-actions {
    display: grid;
  }

  .admin-upload-button {
    width: 100%;
  }
}
</style>

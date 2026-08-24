<template>
  <section class="admin-upload" aria-label="Upload video">
    <h2>{{ busy ? "Video in progress" : "Upload video" }}</h2>
    <p v-if="!busy">The video will be processed on the server and appear under Untagged when it finishes.</p>

    <p v-if="checking && !busy" class="status-message info" data-testid="upload-checking">
      Checking for an upload in progress...
    </p>

    <input
      id="admin-upload-file"
      ref="fileInput"
      class="admin-upload-input"
      type="file"
      accept="video/*,.mp4,.m4v,.mov,.mkv,.webm,.ts"
      data-testid="upload-file-input"
      @change="onFileChange"
    >

    <p v-if="displayedFileName" class="admin-upload-filename" data-testid="upload-file-name">
      {{ displayedFileName }}
    </p>

    <div v-if="!busy" class="admin-upload-actions">
      <button
        class="secondary-button admin-upload-button"
        type="button"
        data-testid="upload-select"
        :disabled="checking"
        @click="openFilePicker"
      >
        Select video
      </button>
      <button
        class="primary-button admin-upload-button"
        type="button"
        data-testid="upload-submit"
        :disabled="checking || !canWrite"
        @click="submitUpload"
      >
        Upload video
      </button>
    </div>

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
        <span class="admin-upload-step-body">
          <span>{{ uploadStepLabel(step, job) }}</span>
          <span
            v-if="step.id === 'processing' && showsConversionProgress(job)"
            class="admin-upload-progress"
            data-testid="upload-progress-bar"
            role="progressbar"
            :aria-valuenow="job.progress ?? 0"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span class="admin-upload-progress-fill" :style="{ width: `${job.progress ?? 0}%` }" />
          </span>
        </span>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import { ApiRequestError, uploadVideo } from "../api/client.js";
import { useAuth } from "../auth/session.js";
import { useUploadJobPolling } from "../composables/use-upload-job-polling.js";
import {
  buildUploadSteps,
  isUploadJobActive,
  mapUploadError,
  showsConversionProgress,
  uploadStepLabel,
} from "../utils/upload-job.js";
import type { UploadStepState } from "../utils/upload-job.js";
import ErrorMessage from "./ErrorMessage.vue";

const emit = defineEmits<{
  completed: [];
}>();

const { canWrite } = useAuth();
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const submitting = ref(false);
const checking = ref(true);
const { job, pollWarning, start, beginLocalUpload, reset, resumeActive } = useUploadJobPolling();

const selectedFileName = computed(() => selectedFile.value?.name ?? "");
const displayedFileName = computed(() => selectedFileName.value || job.value?.videoId || "");
const busy = computed(() => submitting.value || isUploadJobActive(job.value));
const steps = computed(() => buildUploadSteps(job.value));

onMounted(() => {
  void (async () => {
    await resumeActive();
    checking.value = false;
  })();
});

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
  if (!canWrite.value || submitting.value) {
    return;
  }

  if (selectedFile.value === null) {
    error.value = "Select a video first.";
    return;
  }

  error.value = null;
  successMessage.value = null;

  if (await resumeActive() || busy.value) {
    return;
  }

  const file = selectedFile.value;
  submitting.value = true;
  beginLocalUpload(file.name);

  try {
    const accepted = await uploadVideo(file);
    start(accepted.jobId, {
      jobId: accepted.jobId,
      status: accepted.status,
      phase: "uploading",
      videoId: file.name,
      converted: null,
      progress: null,
      outputs: null,
    });
  } catch (uploadError: unknown) {
    if (await recoverActiveJob(uploadError)) {
      return;
    }

    error.value = mapUploadError(uploadError);
    reset();
  } finally {
    submitting.value = false;
  }
}

async function recoverActiveJob(uploadError: unknown): Promise<boolean> {
  if (!(uploadError instanceof ApiRequestError) || uploadError.status !== 409) {
    return false;
  }

  if (uploadError.message.includes("already exists")) {
    return false;
  }

  if (uploadError.jobId !== null) {
    start(uploadError.jobId);
    return true;
  }

  return resumeActive();
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
      successMessage.value = "Video added successfully";
      emit("completed");
    }

    if (status === "failed") {
      error.value = "The video could not be processed.";
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

.admin-upload-step-body {
  display: grid;
  flex: 1;
  gap: 0.35rem;
  min-width: 0;
}

.admin-upload-progress {
  background: #e8eaed;
  border-radius: 999px;
  display: block;
  height: 0.4rem;
  overflow: hidden;
}

.admin-upload-progress-fill {
  background: #1a73e8;
  display: block;
  height: 100%;
  min-width: 0;
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

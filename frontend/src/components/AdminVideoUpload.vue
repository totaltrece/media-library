<template>
  <section class="admin-upload" aria-label="Upload videos">
    <h2>{{ heading }}</h2>
    <p v-if="!busy">Select one or more videos. They are processed one at a time and appear under Untagged when each one finishes.</p>

    <p v-if="checking && !busy" class="status-message info" data-testid="upload-checking">
      Checking for an upload in progress...
    </p>

    <input
      id="admin-upload-file"
      ref="fileInput"
      class="admin-upload-input"
      type="file"
      accept="video/*,.mp4,.m4v,.mov,.mkv,.webm,.ts"
      multiple
      data-testid="upload-file-input"
      @change="onFileChange"
    >

    <ul v-if="!busy && selectedFiles.length > 0" class="admin-upload-files" data-testid="upload-selected">
      <li
        v-for="(file, index) in selectedFiles"
        :key="`${file.name}-${index}`"
        class="admin-upload-filename"
        data-testid="upload-file-name"
      >
        {{ file.name }}
      </li>
    </ul>
    <p v-else-if="displayedFileName" class="admin-upload-filename" data-testid="upload-file-name">
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
        Select videos
      </button>
      <button
        class="primary-button admin-upload-button"
        type="button"
        data-testid="upload-submit"
        :disabled="checking || !canWrite"
        @click="submitUpload"
      >
        Upload videos
      </button>
    </div>

    <ErrorMessage v-if="error" :message="error" />
    <p v-if="pollWarning" class="status-message info" data-testid="upload-poll-warning">
      {{ pollWarning }}
    </p>
    <p v-if="successMessage" class="status-message info" data-testid="upload-success">
      {{ successMessage }}
    </p>

    <ul v-if="queueEntries.length > 0" class="admin-upload-queue" data-testid="upload-queue">
      <li v-for="entry in queueEntries" :key="entry.key" data-testid="upload-queue-item">
        {{ entry.label }} — Queued
      </li>
    </ul>

    <ol v-if="job && !isUploadJobQueued(job)" class="admin-upload-steps" data-testid="upload-steps">
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
import type { UploadAcceptedResponse, UploadJobView } from "../api/types.js";
import { useAuth } from "../auth/session.js";
import { useUploadJobPolling } from "../composables/use-upload-job-polling.js";
import {
  buildUploadSteps,
  isUploadJobActive,
  isUploadJobQueued,
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
const selectedFiles = ref<File[]>([]);
const pendingQueueNames = ref<string[]>([]);
const error = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const submitting = ref(false);
const checking = ref(true);
const { job, queued, pollWarning, start, rememberQueued, beginLocalUpload, reset, resumeActive } = useUploadJobPolling();

const displayedFileName = computed(() => job.value?.videoId || "");
const busy = computed(() =>
  submitting.value
  || pendingQueueNames.value.length > 0
  || isUploadJobActive(job.value)
  || isUploadJobQueued(job.value)
  || queued.value.length > 0,
);
const heading = computed(() => {
  if (!busy.value) {
    return "Upload video";
  }

  const waiting = queued.value.length + pendingQueueNames.value.length + (isUploadJobQueued(job.value) ? 1 : 0);
  const active = submitting.value || isUploadJobActive(job.value) ? 1 : 0;
  return waiting + active > 1 ? "Videos in progress" : "Video in progress";
});
const steps = computed(() => buildUploadSteps(job.value));
const queueEntries = computed(() => {
  const entries = queued.value.map((item) => ({
    key: item.jobId,
    label: item.videoId ?? "Video",
  }));

  if (job.value !== null && isUploadJobQueued(job.value)) {
    entries.unshift({
      key: job.value.jobId,
      label: job.value.videoId ?? "Video",
    });
  }

  if (entries.length > 0) {
    return entries;
  }

  return pendingQueueNames.value.map((name, index) => ({
    key: `${name}-${index}`,
    label: name,
  }));
});

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
  selectedFiles.value = input.files === null ? [] : [...input.files];
  error.value = null;
  successMessage.value = null;
}

async function submitUpload(): Promise<void> {
  if (!canWrite.value || submitting.value) {
    return;
  }

  if (selectedFiles.value.length === 0) {
    error.value = "Select a video first.";
    return;
  }

  error.value = null;
  successMessage.value = null;

  if (await resumeActive() || busy.value) {
    return;
  }

  const files = [...selectedFiles.value];
  const accepted: Array<{ file: File; response: UploadAcceptedResponse }> = [];
  const problems: string[] = [];
  let recovered = false;
  submitting.value = true;
  pendingQueueNames.value = files.slice(1).map((file) => file.name);
  beginLocalUpload(files[0]?.name ?? "video");

  try {
    for (const file of files) {
      try {
        accepted.push({ file, response: await uploadVideo(file) });
      } catch (uploadError: unknown) {
        if (await recoverActiveJob(uploadError)) {
          recovered = true;
          return;
        }

        problems.push(mapUploadError(uploadError));
      }
    }
  } finally {
    submitting.value = false;
    pendingQueueNames.value = [];
  }

  if (recovered || accepted.length === 0) {
    if (!recovered) {
      error.value = problems[0] ?? "The video could not be uploaded. Check your connection.";
      reset();
    }

    return;
  }

  const primary = accepted.find((item) => item.response.status !== "queued") ?? accepted[0];

  if (primary === undefined) {
    return;
  }

  start(primary.response.jobId, toJobView(primary.response, primary.file.name));
  rememberQueued(
    accepted
      .filter((item) => item.response.jobId !== primary.response.jobId && item.response.status === "queued")
      .map((item) => toJobView(item.response, item.file.name)),
  );
  selectedFiles.value = [];

  if (fileInput.value !== null) {
    fileInput.value.value = "";
  }

  if (problems.length > 0) {
    error.value = problems.join(" ");
  }
}

function toJobView(response: UploadAcceptedResponse, fileName: string): UploadJobView {
  const status = response.status === "queued" ? "queued" : "uploading";

  return {
    jobId: response.jobId,
    status,
    phase: status,
    videoId: fileName,
    converted: null,
    progress: null,
    outputs: null,
  };
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

.admin-upload-files,
.admin-upload-queue {
  display: grid;
  gap: 0.35rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.admin-upload-filename {
  color: #202124;
  font-weight: 600;
  margin: 0;
  overflow-wrap: anywhere;
}

.admin-upload-queue {
  color: #3c4043;
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

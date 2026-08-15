<template>
  <div class="app-shell">
    <AppHeader
      title="Edit video"
      :subtitle="pageSubtitle"
      @refreshed="loadVideo"
    />

    <LoadingIndicator v-if="loading" message="Loading video..." />
    <ErrorMessage v-else-if="error" :message="error" />

    <template v-else-if="video">
      <div class="admin-video-edit">
        <div class="admin-video-preview">
          <SearchResultItem
            :interactive-tags="false"
            :show-name="true"
            :result="previewResult"
            :selected="false"
            @select-video="showPlayer = true"
          />
        </div>

        <div class="admin-video-tags">
          <TagEditor v-model:tags="draftTags" :available-tags="availableTags" />

          <div class="search-actions">
            <button
              class="primary-button"
              data-testid="save-tags"
              type="button"
              :disabled="saving || deleting || !isDirty"
              @click="saveTags"
            >
              {{ saving ? "Saving..." : "Save changes" }}
            </button>
            <button
              class="danger-button"
              data-testid="delete-video"
              type="button"
              :disabled="saving || deleting"
              @click="openDeleteModal"
            >
              Delete video
            </button>
          </div>

          <p v-if="saveMessage" class="status-message info" role="status">
            {{ saveMessage }}
          </p>
          <ErrorMessage v-if="saveError" :message="saveError" />
          <ErrorMessage v-if="deleteError" :message="deleteError" />
        </div>
      </div>
    </template>

    <div
      v-if="confirmingDelete"
      class="video-modal-backdrop"
      role="presentation"
      @click.self="cancelDelete"
    >
      <div
        class="admin-video-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-video-title"
        aria-describedby="delete-video-description"
      >
        <p id="delete-video-title">Delete video?</p>
        <p id="delete-video-description">
          This will delete the video and its thumbnail from the library, and all of its tag relations. This cannot be undone.
        </p>
        <div class="search-actions">
          <button
            class="secondary-button"
            data-testid="cancel-delete-video"
            type="button"
            :disabled="deleting"
            @click="cancelDelete"
          >
            Cancel
          </button>
          <button
            class="danger-button"
            data-testid="confirm-delete-video"
            type="button"
            :disabled="deleting"
            @click="confirmDelete"
          >
            {{ deleting ? "Deleting..." : "Delete video" }}
          </button>
        </div>
      </div>
    </div>

    <VideoPlayer
      v-if="video && showPlayer"
      :tags="draftTags"
      :video-path="video.video"
      @close="showPlayer = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { ApiRequestError, deleteVideo, fetchTags, fetchVideoTags, searchVideos, updateVideoTags } from "../api/client.js";
import type { SearchResultItem as VideoResult } from "../api/types.js";
import AppHeader from "../components/AppHeader.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import SearchResultItem from "../components/SearchResultItem.vue";
import TagEditor from "../components/TagEditor.vue";
import VideoPlayer from "../components/VideoPlayer.vue";

const props = defineProps<{
  id: string;
}>();

const router = useRouter();
const video = ref<VideoResult | null>(null);
const availableTags = ref<string[]>([]);
const savedTags = ref<string[]>([]);
const draftTags = ref<string[]>([]);
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const confirmingDelete = ref(false);
const showPlayer = ref(false);
const error = ref<string | null>(null);
const saveError = ref<string | null>(null);
const deleteError = ref<string | null>(null);
const saveMessage = ref<string | null>(null);

const isDirty = computed(
  () => JSON.stringify(draftTags.value) !== JSON.stringify(savedTags.value),
);

const pageSubtitle = computed(
  () => `Edit tags for "${video.value?.name ?? props.id}"`,
);

const previewResult = computed(() => {
  if (video.value === null) {
    return {
      id: props.id,
      name: props.id,
      thumbnail: `/api/thumbnail/${props.id}`,
      video: `/api/video/${props.id}`,
      tags: draftTags.value,
    };
  }

  return {
    ...video.value,
    tags: draftTags.value,
  };
});

watch(
  () => props.id,
  async () => {
    await loadVideo();
  },
  { immediate: true },
);

async function loadVideo(): Promise<void> {
  loading.value = true;
  error.value = null;
  saveError.value = null;
  deleteError.value = null;
  saveMessage.value = null;
  confirmingDelete.value = false;
  showPlayer.value = false;

  try {
    const [searchResponse, videoTags, catalog] = await Promise.all([
      searchVideos([]),
      fetchVideoTags(props.id),
      fetchTags(),
    ]);

    video.value = searchResponse.results.find((result) => result.id === props.id) ?? {
      id: props.id,
      name: props.id.split("/").at(-1) ?? props.id,
      thumbnail: `/api/thumbnail/${props.id}`,
      video: `/api/video/${props.id}`,
      tags: videoTags.tags,
    };
    savedTags.value = [...videoTags.tags];
    draftTags.value = [...videoTags.tags];
    availableTags.value = catalog.tags;
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load video tags.";
  } finally {
    loading.value = false;
  }
}

async function saveTags(): Promise<void> {
  saving.value = true;
  saveError.value = null;
  saveMessage.value = null;

  try {
    const response = await updateVideoTags(props.id, draftTags.value);
    savedTags.value = [...response.tags];
    draftTags.value = [...response.tags];
    availableTags.value = uniqueTags([...availableTags.value, ...response.tags]);
    saveMessage.value = "Tags saved.";
  } catch (updateError: unknown) {
    saveError.value = updateError instanceof Error ? updateError.message : "Unable to save tags.";
  } finally {
    saving.value = false;
  }
}

function openDeleteModal(): void {
  if (deleting.value) {
    return;
  }

  deleteError.value = null;
  confirmingDelete.value = true;
}

function cancelDelete(): void {
  if (deleting.value) {
    return;
  }

  confirmingDelete.value = false;
}

async function confirmDelete(): Promise<void> {
  if (deleting.value) {
    return;
  }

  deleting.value = true;
  deleteError.value = null;

  try {
    await deleteVideo(props.id);
    confirmingDelete.value = false;
    await router.push({ name: "admin-videos" });
  } catch (removeError: unknown) {
    if (removeError instanceof ApiRequestError && removeError.status === 404) {
      confirmingDelete.value = false;
      await router.push({ name: "admin-videos" });
      return;
    }

    deleteError.value = removeError instanceof Error ? removeError.message : "Unable to delete video.";
    confirmingDelete.value = false;
  } finally {
    deleting.value = false;
  }
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)];
}
</script>

<style scoped>
.admin-video-edit {
  align-items: start;
  display: grid;
  gap: 1.5rem;
  grid-template-columns: minmax(0, 220px) minmax(0, 1fr);
}

.admin-video-preview {
  max-width: 220px;
}

.admin-video-tags {
  display: grid;
  gap: 1.25rem;
}

.admin-video-confirm-modal {
  background: #fff;
  border-radius: 1rem;
  display: grid;
  gap: 0.75rem;
  max-width: 24rem;
  padding: 1.25rem;
  width: 100%;
}

.admin-video-confirm-modal p {
  margin: 0;
}

.admin-video-confirm-modal p:first-child {
  font-weight: 600;
}

@media (max-width: 599px) {
  .admin-video-edit {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

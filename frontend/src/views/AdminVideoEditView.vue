<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-row">
        <div>
          <h1>{{ video?.name ?? "Edit tags" }}</h1>
          <p>Edit tags for this video. Changes are saved to the library.</p>
        </div>
        <div class="search-actions">
          <AdminNav />
          <RouterLink class="secondary-button" to="/admin/videos">Back to videos</RouterLink>
        </div>
      </div>
    </header>

    <LoadingIndicator v-if="loading" message="Loading video..." />
    <ErrorMessage v-else-if="error" :message="error" />

    <template v-else-if="video">
      <div class="admin-video-preview">
        <SearchResultItem
          :interactive-tags="false"
          :show-name="true"
          :result="previewResult"
          :selected="false"
          @select-video="showPlayer = true"
        />
      </div>

      <TagEditor v-model:tags="draftTags" :available-tags="availableTags" />

      <div class="search-actions">
        <button
          class="primary-button"
          data-testid="save-tags"
          type="button"
          :disabled="saving || !isDirty"
          @click="saveTags"
        >
          {{ saving ? "Saving..." : "Guardar cambios" }}
        </button>
      </div>

      <p v-if="saveMessage" class="status-message info" role="status">
        {{ saveMessage }}
      </p>
      <ErrorMessage v-if="saveError" :message="saveError" />
    </template>

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

import { fetchTags, fetchVideoTags, searchVideos, updateVideoTags } from "../api/client.js";
import type { SearchResultItem as VideoResult } from "../api/types.js";
import AdminNav from "../components/AdminNav.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import SearchResultItem from "../components/SearchResultItem.vue";
import TagEditor from "../components/TagEditor.vue";
import VideoPlayer from "../components/VideoPlayer.vue";

const props = defineProps<{
  id: string;
}>();

const video = ref<VideoResult | null>(null);
const availableTags = ref<string[]>([]);
const savedTags = ref<string[]>([]);
const draftTags = ref<string[]>([]);
const loading = ref(true);
const saving = ref(false);
const showPlayer = ref(false);
const error = ref<string | null>(null);
const saveError = ref<string | null>(null);
const saveMessage = ref<string | null>(null);

const isDirty = computed(
  () => JSON.stringify(draftTags.value) !== JSON.stringify(savedTags.value),
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
    loading.value = true;
    error.value = null;
    saveError.value = null;
    saveMessage.value = null;
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
  },
  { immediate: true },
);

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

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)];
}
</script>

<style scoped>
.admin-video-preview {
  margin-bottom: 1.5rem;
  max-width: 220px;
}
</style>

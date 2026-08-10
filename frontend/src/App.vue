<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-row">
        <div>
          <h1>Media Library</h1>
          <p>Search your tagged videos and watch them from any browser.</p>
        </div>
        <button
          class="refresh-button"
          type="button"
          :aria-busy="refreshing"
          :disabled="refreshing"
          @click="refreshLibrary"
        >
          <span class="refresh-button-icon" aria-hidden="true">↻</span>
          {{ refreshing ? "Refreshing..." : "Refresh library" }}
        </button>
      </div>
    </header>

    <TagSearch
      :available-tags="availableTags"
      :searching="loadingSearch"
      :selected-tags="selectedTags"
      @add-tag="addTag"
      @clear-tags="clearTags"
      @remove-tag="removeTag"
      @search="runSearch"
    />

    <LoadingIndicator v-if="loadingTags" message="Loading tags..." />

    <ErrorMessage v-else-if="tagsError" :message="tagsError" />

    <ErrorMessage v-if="refreshError" :message="refreshError" />

    <p v-else-if="availableTags.length === 0" class="status-message info">
      No tags are available in the indexed library.
    </p>

    <LoadingIndicator v-if="loadingSearch" message="Searching videos..." />

    <ErrorMessage v-if="searchError" :message="searchError" />

    <div class="content-layout">
      <SearchResults
        :results="searchResults"
        :searched="hasSearched"
        :selected-video-id="selectedVideo?.id ?? null"
        @select-video="selectVideo"
      />
    </div>

    <VideoPlayer
      v-if="selectedVideo"
      :tags="selectedVideo.tags"
      :video-path="selectedVideo.video"
      @close="closeVideo"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import { fetchTags, refreshLibrary as refreshLibraryIndex, searchVideos } from "./api/client.js";
import type { SearchResultItem } from "./api/types.js";
import ErrorMessage from "./components/ErrorMessage.vue";
import LoadingIndicator from "./components/LoadingIndicator.vue";
import SearchResults from "./components/SearchResults.vue";
import TagSearch from "./components/TagSearch.vue";
import VideoPlayer from "./components/VideoPlayer.vue";

const availableTags = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const searchResults = ref<SearchResultItem[]>([]);
const selectedVideo = ref<SearchResultItem | null>(null);

const loadingTags = ref(true);
const loadingSearch = ref(false);
const refreshing = ref(false);
const hasSearched = ref(false);

const tagsError = ref<string | null>(null);
const searchError = ref<string | null>(null);
const refreshError = ref<string | null>(null);

onMounted(async () => {
  try {
    const response = await fetchTags();
    availableTags.value = response.tags;
  } catch (error: unknown) {
    tagsError.value = error instanceof Error ? error.message : "Unable to load tags.";
  } finally {
    loadingTags.value = false;
  }
});

function addTag(tag: string): void {
  if (!selectedTags.value.includes(tag)) {
    selectedTags.value = [...selectedTags.value, tag];
  }
}

function removeTag(tag: string): void {
  selectedTags.value = selectedTags.value.filter((selectedTag) => selectedTag !== tag);
}

function clearTags(): void {
  selectedTags.value = [];
  searchResults.value = [];
  selectedVideo.value = null;
  hasSearched.value = false;
  searchError.value = null;
}

async function runSearch(): Promise<void> {
  if (selectedTags.value.length === 0) {
    return;
  }

  loadingSearch.value = true;
  searchError.value = null;
  selectedVideo.value = null;

  try {
    const response = await searchVideos(selectedTags.value);
    searchResults.value = response.results;
    hasSearched.value = true;
  } catch (error: unknown) {
    searchResults.value = [];
    hasSearched.value = true;
    searchError.value = error instanceof Error ? error.message : "Unable to search videos.";
  } finally {
    loadingSearch.value = false;
  }
}

function selectVideo(result: SearchResultItem): void {
  selectedVideo.value = result;
}

function closeVideo(): void {
  selectedVideo.value = null;
}

async function refreshLibrary(): Promise<void> {
  if (refreshing.value) {
    return;
  }

  refreshing.value = true;
  refreshError.value = null;

  try {
    await refreshLibraryIndex();

    const response = await fetchTags();
    availableTags.value = response.tags;
    tagsError.value = null;

    if (hasSearched.value && selectedTags.value.length > 0) {
      await runSearch();
    }
  } catch (error: unknown) {
    refreshError.value =
      error instanceof Error ? error.message : "Unable to refresh the media library.";
  } finally {
    refreshing.value = false;
  }
}
</script>

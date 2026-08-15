<template>
  <div class="app-shell">
    <AppHeader
      title="Media Library"
      subtitle="Search your tagged videos and watch them from any browser."
      @refreshed="onLibraryRefreshed"
    />

    <TagSearch
      :available-tags="availableTags"
      :selected-tags="selectedTags"
      @add-tag="addTag"
      @clear-tags="clearTags"
      @remove-tag="removeTag"
    />

    <LoadingIndicator v-if="loadingCatalog" message="Loading videos..." />

    <ErrorMessage v-else-if="error" :message="error" />

    <template v-else>
      <p v-if="availableTags.length === 0" class="status-message info">
        No tags are available in the indexed library.
      </p>

      <LoadingIndicator v-if="loadingSearch" message="Searching videos..." />
      <ErrorMessage v-if="searchError" :message="searchError" />

      <div class="content-layout">
        <SearchResults
          :results="visibleVideos"
          :searched="true"
          :selected-video-id="selectedVideo?.id ?? null"
          @select-tag="addTag"
          @select-video="selectVideo"
        />
      </div>
    </template>

    <VideoPlayer
      v-if="selectedVideo"
      :tags="selectedVideo.tags"
      :video-path="selectedVideo.video"
      @close="closeVideo"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { fetchTags, searchVideos } from "../api/client.js";
import type { SearchResultItem } from "../api/types.js";
import AppHeader from "../components/AppHeader.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import SearchResults from "../components/SearchResults.vue";
import TagSearch from "../components/TagSearch.vue";
import VideoPlayer from "../components/VideoPlayer.vue";

const availableTags = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const catalogVideos = ref<SearchResultItem[]>([]);
const searchResults = ref<SearchResultItem[]>([]);
const selectedVideo = ref<SearchResultItem | null>(null);
const hasSearched = ref(false);

const loadingCatalog = ref(true);
const loadingSearch = ref(false);
const error = ref<string | null>(null);
const searchError = ref<string | null>(null);
let searchGeneration = 0;

const visibleVideos = computed(() => (hasSearched.value ? searchResults.value : catalogVideos.value));

onMounted(async () => {
  try {
    await loadCatalog();
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load videos.";
  } finally {
    loadingCatalog.value = false;
  }
});

async function loadCatalog(): Promise<void> {
  const [searchResponse, tagsResponse] = await Promise.all([searchVideos([]), fetchTags()]);
  catalogVideos.value = searchResponse.results;
  availableTags.value = tagsResponse.tags;
}

function addTag(tag: string): void {
  if (selectedTags.value.includes(tag)) {
    return;
  }

  selectedTags.value = [...selectedTags.value, tag];
  void runSearch();
}

function removeTag(tag: string): void {
  selectedTags.value = selectedTags.value.filter((selectedTag) => selectedTag !== tag);

  if (selectedTags.value.length === 0) {
    resetSearch();
    return;
  }

  void runSearch();
}

function resetSearch(): void {
  searchGeneration += 1;
  searchResults.value = [];
  hasSearched.value = false;
  searchError.value = null;
  loadingSearch.value = false;
  syncSelectedVideo();
}

function clearTags(): void {
  selectedTags.value = [];
  resetSearch();
}

async function runSearch(): Promise<void> {
  if (selectedTags.value.length === 0) {
    resetSearch();
    return;
  }

  const generation = ++searchGeneration;
  loadingSearch.value = true;
  searchError.value = null;

  try {
    const response = await searchVideos(selectedTags.value);

    if (generation !== searchGeneration) {
      return;
    }

    searchResults.value = response.results;
    hasSearched.value = true;
    syncSelectedVideo();
  } catch (searchLoadError: unknown) {
    if (generation !== searchGeneration) {
      return;
    }

    searchResults.value = [];
    hasSearched.value = true;
    searchError.value = searchLoadError instanceof Error ? searchLoadError.message : "Unable to search videos.";
    syncSelectedVideo();
  } finally {
    if (generation === searchGeneration) {
      loadingSearch.value = false;
    }
  }
}

function syncSelectedVideo(): void {
  if (selectedVideo.value === null) {
    return;
  }

  if (!visibleVideos.value.some((video) => video.id === selectedVideo.value?.id)) {
    selectedVideo.value = null;
  }
}

function selectVideo(result: SearchResultItem): void {
  selectedVideo.value = result;
}

function closeVideo(): void {
  selectedVideo.value = null;
}

async function onLibraryRefreshed(): Promise<void> {
  try {
    await loadCatalog();
    error.value = null;

    if (hasSearched.value && selectedTags.value.length > 0) {
      await runSearch();
    }
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load videos.";
  }
}
</script>

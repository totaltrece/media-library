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

    <LoadingIndicator v-if="loadingTags" message="Loading tags..." />

    <ErrorMessage v-else-if="tagsError" :message="tagsError" />

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
        @select-tag="addTag"
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
const searchResults = ref<SearchResultItem[]>([]);
const selectedVideo = ref<SearchResultItem | null>(null);

const loadingTags = ref(true);
const loadingSearch = ref(false);
const hasSearched = ref(false);

const tagsError = ref<string | null>(null);
const searchError = ref<string | null>(null);
let searchGeneration = 0;

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
  if (selectedTags.value.includes(tag)) {
    return;
  }

  selectedTags.value = [...selectedTags.value, tag];
  void runSearch();
}

function removeTag(tag: string): void {
  selectedTags.value = selectedTags.value.filter((selectedTag) => selectedTag !== tag);

  if (selectedTags.value.length === 0) {
    clearSearchResults();
    return;
  }

  void runSearch();
}

function clearSearchResults(): void {
  searchGeneration += 1;
  searchResults.value = [];
  selectedVideo.value = null;
  hasSearched.value = false;
  searchError.value = null;
  loadingSearch.value = false;
}

function clearTags(): void {
  selectedTags.value = [];
  clearSearchResults();
}

async function runSearch(): Promise<void> {
  if (selectedTags.value.length === 0) {
    clearSearchResults();
    return;
  }

  const generation = ++searchGeneration;
  loadingSearch.value = true;
  searchError.value = null;
  selectedVideo.value = null;

  try {
    const response = await searchVideos(selectedTags.value);

    if (generation !== searchGeneration) {
      return;
    }

    searchResults.value = response.results;
    hasSearched.value = true;
  } catch (error: unknown) {
    if (generation !== searchGeneration) {
      return;
    }

    searchResults.value = [];
    hasSearched.value = true;
    searchError.value = error instanceof Error ? error.message : "Unable to search videos.";
  } finally {
    if (generation === searchGeneration) {
      loadingSearch.value = false;
    }
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
    const response = await fetchTags();
    availableTags.value = response.tags;
    tagsError.value = null;

    if (hasSearched.value && selectedTags.value.length > 0) {
      await runSearch();
    }
  } catch (error: unknown) {
    tagsError.value = error instanceof Error ? error.message : "Unable to load tags.";
  }
}
</script>

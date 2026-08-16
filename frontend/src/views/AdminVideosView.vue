<template>
  <div class="app-shell">
    <AppHeader
      title="Media Library"
      subtitle="Find a video, play it, or edit its tags."
      @refreshed="onLibraryRefreshed"
    />

    <div class="admin-filter-row" role="group" aria-label="Video filters">
      <button
        class="secondary-button"
        data-testid="filter-all"
        type="button"
        :class="{ active: !untaggedOnly }"
        :aria-pressed="!untaggedOnly"
        @click="showAllVideos"
      >
        All
      </button>
      <button
        class="secondary-button"
        data-testid="filter-untagged"
        type="button"
        :class="{ active: untaggedOnly }"
        :aria-pressed="untaggedOnly"
        @click="showUntaggedVideos"
      >
        Untagged ({{ untaggedCount }})
      </button>
    </div>

    <TagSearch
      :available-tags="availableTags"
      :selected-tags="selectedTags"
      @add-tag="addTag"
      @clear-tags="clearTags"
      @remove-tag="removeTag"
    />

    <LoadingIndicator v-if="loadingCatalog && !hasSearched" message="Loading videos..." />
    <ErrorMessage v-else-if="error" :message="error" />

    <template v-else>
      <LoadingIndicator v-if="loadingSearch" message="Searching videos..." />
      <ErrorMessage v-if="searchError" :message="searchError" />

      <div class="content-layout">
        <SearchResults
          :empty-message="emptyMessage"
          :show-name="true"
          :name-links-to-edit="true"
          :results="visibleVideos"
          :searched="true"
          :selected-video-id="selectedVideo?.id ?? null"
          @select-tag="selectResultTag"
          @select-video="playVideo"
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
import { computed, onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";

import { fetchTags, searchVideos } from "../api/client.js";
import type { SearchResultItem } from "../api/types.js";
import AppHeader from "../components/AppHeader.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import SearchResults from "../components/SearchResults.vue";
import TagSearch from "../components/TagSearch.vue";
import VideoPlayer from "../components/VideoPlayer.vue";
import { applyUntaggedFilter, countUntaggedVideos } from "../utils/admin-videos.js";

const route = useRoute();
const catalogVideos = ref<SearchResultItem[]>([]);
const searchResults = ref<SearchResultItem[]>([]);
const availableTags = ref<string[]>([]);
const selectedTags = ref<string[]>([]);
const selectedVideo = ref<SearchResultItem | null>(null);
const untaggedOnly = ref(false);
const hasSearched = ref(false);
const loadingCatalog = ref(true);
const loadingSearch = ref(false);
const error = ref<string | null>(null);
const searchError = ref<string | null>(null);
let searchGeneration = 0;

const untaggedCount = computed(() => countUntaggedVideos(catalogVideos.value));

const visibleVideos = computed(() =>
  applyUntaggedFilter(hasSearched.value ? searchResults.value : catalogVideos.value, untaggedOnly.value),
);

const emptyMessage = computed(() =>
  untaggedOnly.value ? "No untagged videos match the current filters." : "No videos match the current filters.",
);

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

function resetSearch(): void {
  searchGeneration += 1;
  selectedTags.value = [];
  searchResults.value = [];
  hasSearched.value = false;
  searchError.value = null;
  loadingSearch.value = false;
  syncSelectedVideo();
}

function showAllVideos(): void {
  untaggedOnly.value = false;
  syncSelectedVideo();
}

function showUntaggedVideos(): void {
  resetSearch();
  untaggedOnly.value = true;
}

function addTag(tag: string): void {
  if (selectedTags.value.includes(tag)) {
    return;
  }

  selectedTags.value = [...selectedTags.value, tag];
  void runSearch();
}

function selectResultTag(tag: string): void {
  addTag(tag);
}

function removeTag(tag: string): void {
  selectedTags.value = selectedTags.value.filter((selectedTag) => selectedTag !== tag);

  if (selectedTags.value.length === 0) {
    searchGeneration += 1;
    searchResults.value = [];
    hasSearched.value = false;
    searchError.value = null;
    loadingSearch.value = false;
    syncSelectedVideo();
    return;
  }

  void runSearch();
}

function clearTags(): void {
  resetSearch();
}

async function runSearch(): Promise<void> {
  if (selectedTags.value.length === 0) {
    return;
  }

  const generation = ++searchGeneration;
  untaggedOnly.value = false;
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

function parseRouteTags(value: unknown): string[] {
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }

  return [];
}

watch(
  () => route.query.untagged,
  (value) => {
    if (value === "1") {
      resetSearch();
      untaggedOnly.value = true;
    }
  },
  { immediate: true },
);

watch(
  () => route.query.tag,
  async () => {
    const tags = parseRouteTags(route.query.tag);

    if (tags.length === 0) {
      return;
    }

    selectedTags.value = tags;
    await runSearch();
  },
  { immediate: true },
);

function playVideo(result: SearchResultItem): void {
  selectedVideo.value = result;
}

function closeVideo(): void {
  selectedVideo.value = null;
}

function syncSelectedVideo(): void {
  if (selectedVideo.value === null) {
    return;
  }

  if (!visibleVideos.value.some((video) => video.id === selectedVideo.value?.id)) {
    selectedVideo.value = null;
  }
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

<style scoped>
.admin-filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.secondary-button.active {
  background: #1a73e8;
  color: #fff;
}
</style>

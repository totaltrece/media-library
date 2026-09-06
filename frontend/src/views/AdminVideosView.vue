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
      :default-color="defaultColor"
      :selected-tags="selectedTags"
      :tag-colors="tagColors"
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
          :default-color="defaultColor"
          :results="visibleVideos"
          :searched="true"
          :selected-video-id="selectedVideo?.id ?? null"
          :tag-colors="tagColors"
          @select-tag="selectResultTag"
          @select-video="playVideo"
        />
      </div>
    </template>

    <VideoPlayer
      v-if="selectedVideo"
      :default-color="defaultColor"
      :tag-colors="tagColors"
      :tags="selectedVideo.tags"
      :video-path="selectedVideo.video"
      @close="closeVideo"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import { fetchTags, searchVideos } from "../api/client.js";
import type { SearchResultItem } from "../api/types.js";
import AppHeader from "../components/AppHeader.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import SearchResults from "../components/SearchResults.vue";
import TagSearch from "../components/TagSearch.vue";
import VideoPlayer from "../components/VideoPlayer.vue";
import { applyUntaggedFilter, countUntaggedVideos } from "../utils/admin-videos.js";
import { homeSearchQuery, parseRouteTags, sameTags } from "../utils/home-search-query.js";
import { HOME_SEARCH_TAGS_KEY, readStoredHomeTags, writeSessionJson } from "../utils/session-state.js";
import { DEFAULT_TAG_COLOR, tagColorMap } from "../utils/tag-color.js";

const route = useRoute();
const router = useRouter();
const catalogVideos = ref<SearchResultItem[]>([]);
const searchResults = ref<SearchResultItem[]>([]);
const availableTags = ref<string[]>([]);
const tagColors = ref<Record<string, string>>({});
const defaultColor = ref(DEFAULT_TAG_COLOR);
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
  availableTags.value = tagsResponse.tags.map((tag) => tag.name);
  tagColors.value = tagColorMap(tagsResponse.tags);
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

function persistHomeTags(tags: string[]): void {
  writeSessionJson(HOME_SEARCH_TAGS_KEY, tags);
}

async function syncHomeLocation(tags: string[], untagged: boolean): Promise<void> {
  persistHomeTags(untagged ? [] : tags);
  const query = homeSearchQuery(tags, untagged);
  const currentTags = parseRouteTags(route.query.tag);
  const currentUntagged = route.query.untagged === "1";

  if (currentUntagged === untagged && sameTags(currentTags, untagged ? [] : tags)) {
    return;
  }

  await router.replace({ name: "home", query });
}

function showAllVideos(): void {
  untaggedOnly.value = false;
  syncSelectedVideo();
  void syncHomeLocation(selectedTags.value, false);
}

function showUntaggedVideos(): void {
  resetSearch();
  untaggedOnly.value = true;
  void syncHomeLocation([], true);
}

function addTag(tag: string): void {
  if (selectedTags.value.includes(tag)) {
    return;
  }

  selectedTags.value = [...selectedTags.value, tag];
  void syncHomeLocation(selectedTags.value, false);
  void runSearch();
}

function selectResultTag(tag: string): void {
  addTag(tag);
}

function removeTag(tag: string): void {
  selectedTags.value = selectedTags.value.filter((selectedTag) => selectedTag !== tag);
  void syncHomeLocation(selectedTags.value, false);

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
  void syncHomeLocation([], false);
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

watch(
  () => [route.query.tag, route.query.untagged] as const,
  async () => {
    if (route.name !== undefined && route.name !== "home") {
      return;
    }

    const urlUntagged = route.query.untagged === "1";
    const urlTags = parseRouteTags(route.query.tag);

    if (urlUntagged) {
      persistHomeTags([]);

      if (!untaggedOnly.value || selectedTags.value.length > 0) {
        resetSearch();
        untaggedOnly.value = true;
      }

      return;
    }

    if (urlTags.length > 0) {
      if (sameTags(selectedTags.value, urlTags) && hasSearched.value) {
        return;
      }

      selectedTags.value = urlTags;
      persistHomeTags(urlTags);
      await runSearch();
      return;
    }

    const storedTags = readStoredHomeTags();

    if (storedTags.length > 0) {
      selectedTags.value = storedTags;
      await syncHomeLocation(storedTags, false);
      await runSearch();
      return;
    }

    if (selectedTags.value.length > 0 || untaggedOnly.value) {
      resetSearch();
      untaggedOnly.value = false;
    }
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

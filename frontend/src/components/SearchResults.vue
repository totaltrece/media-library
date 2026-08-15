<template>
  <section v-if="searched" class="search-results" aria-live="polite">
    <div class="results-heading">
      <h2>{{ heading }}</h2>
      <div v-if="results.length > 0" class="results-sort" role="group" aria-label="Sort videos">
        <button
          class="secondary-button active"
          type="button"
          data-testid="sort-date"
          :aria-label="dateSortLabel"
          :aria-pressed="true"
          @click="toggleDateSort"
        >
          Date{{ dateSort === "desc" ? " ↑" : " ↓" }}
        </button>
      </div>
    </div>

    <p v-if="results.length === 0" class="status-message info">
      {{ emptyMessage }}
    </p>

    <div v-else class="results-grid">
      <SearchResultItem
        v-for="result in sortedResults"
        :key="result.id"
        :interactive-tags="interactiveTags"
        :show-name="showName"
        :result="result"
        :selected="result.id === selectedVideoId"
        @select-tag="$emit('select-tag', $event)"
        @select-video="$emit('select-video', result)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import type { SearchResultItem as SearchResult } from "../api/types.js";
import { sortVideosByRecordedAt, type DateSortDirection } from "../utils/video-date.js";

import SearchResultItem from "./SearchResultItem.vue";

const props = withDefaults(
  defineProps<{
    results: SearchResult[];
    selectedVideoId: string | null;
    searched: boolean;
    emptyMessage?: string;
    interactiveTags?: boolean;
    showName?: boolean;
  }>(),
  {
    emptyMessage: "No videos match the selected tags.",
    interactiveTags: true,
    showName: false,
  },
);

defineEmits<{
  "select-tag": [tag: string];
  "select-video": [result: SearchResult];
}>();

const dateSort = ref<DateSortDirection>("asc");

const heading = computed(() => {
  return `${props.results.length} result${props.results.length === 1 ? "" : "s"}`;
});

const dateSortLabel = computed(() =>
  dateSort.value === "desc" ? "Sort by date, newest first" : "Sort by date, oldest first",
);

const sortedResults = computed(() => sortVideosByRecordedAt(props.results, dateSort.value));

function toggleDateSort(): void {
  dateSort.value = dateSort.value === "asc" ? "desc" : "asc";
}
</script>

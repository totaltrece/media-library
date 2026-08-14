<template>
  <section v-if="searched" class="search-results" aria-live="polite">
    <h2>{{ heading }}</h2>

    <p v-if="results.length === 0" class="status-message info">
      {{ emptyMessage }}
    </p>

    <div v-else class="results-grid">
      <SearchResultItem
        v-for="result in results"
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
import { computed } from "vue";

import type { SearchResultItem as SearchResult } from "../api/types.js";

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

const heading = computed(() => {
  return `${props.results.length} result${props.results.length === 1 ? "" : "s"}`;
});
</script>

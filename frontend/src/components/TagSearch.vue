<template>
  <section class="tag-search" aria-label="Tag search">
    <div class="tag-input-row">
      <div ref="tagInputWrapper" class="tag-input-wrapper">
        <label class="visually-hidden" for="tag-input">Search tags</label>
        <input
          id="tag-input"
          v-model="query"
          autocomplete="off"
          placeholder="Type to find tags"
          type="search"
          @focus="openSuggestions"
          @keydown.enter.prevent="selectHighlightedSuggestion"
          @keydown.escape="closeSuggestions"
        />

        <ul v-if="showSuggestions" class="tag-suggestions">
          <li v-for="(tag, index) in filteredSuggestions" :key="tag">
            <button type="button" @click="selectTag(tag)">
              {{ tag }}
            </button>
          </li>
          <li v-if="filteredSuggestions.length === 0">
            <button disabled type="button">No matching tags</button>
          </li>
        </ul>
      </div>

      <div v-if="selectedTags.length > 0" class="selected-tags" aria-label="Selected tags">
        <span v-for="tag in selectedTags" :key="tag" class="tag-chip">
          {{ tag }}
          <button
            :aria-label="`Remove ${tag}`"
            type="button"
            @click="$emit('remove-tag', tag)"
          >
            ×
          </button>
        </span>
      </div>
    </div>

    <div class="search-actions">
      <button
        class="primary-button"
        type="button"
        :disabled="selectedTags.length === 0 || searching"
        @click="$emit('search')"
      >
        Search
      </button>
      <button
        class="secondary-button"
        type="button"
        :disabled="selectedTags.length === 0"
        @click="$emit('clear-tags')"
      >
        Clear tags
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  availableTags: string[];
  selectedTags: string[];
  searching: boolean;
}>();

const emit = defineEmits<{
  "add-tag": [tag: string];
  "remove-tag": [tag: string];
  search: [];
  "clear-tags": [];
}>();

const query = ref("");
const showSuggestions = ref(false);
const tagInputWrapper = ref<HTMLElement | null>(null);

const filteredSuggestions = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  return props.availableTags.filter((tag) => {
    if (props.selectedTags.includes(tag)) {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    return tag.toLowerCase().includes(normalizedQuery);
  });
});

function openSuggestions(): void {
  showSuggestions.value = true;
}

function selectTag(tag: string): void {
  emit("add-tag", tag);
  query.value = "";
  showSuggestions.value = false;
}

function selectHighlightedSuggestion(): void {
  const firstSuggestion = filteredSuggestions.value[0];

  if (firstSuggestion !== undefined) {
    selectTag(firstSuggestion);
  }
}

function closeSuggestions(): void {
  showSuggestions.value = false;
}

function handleDocumentClick(event: MouseEvent): void {
  if (!showSuggestions.value) {
    return;
  }

  const target = event.target;

  if (target instanceof Node && tagInputWrapper.value?.contains(target)) {
    return;
  }

  closeSuggestions();
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>

<style scoped>
.visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
}
</style>

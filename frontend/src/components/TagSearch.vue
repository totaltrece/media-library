<template>
  <section class="tag-search" aria-label="Tag search">
    <div class="tag-input-row">
      <TagSuggestionInput
        input-id="tag-input"
        input-type="search"
        label="Search tags"
        placeholder="Type to find tags"
        :available-tags="availableTags"
        :selected-tags="selectedTags"
        @select="$emit('add-tag', $event)"
      />

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
import TagSuggestionInput from "./TagSuggestionInput.vue";

defineProps<{
  availableTags: string[];
  selectedTags: string[];
  searching: boolean;
}>();

defineEmits<{
  "add-tag": [tag: string];
  "remove-tag": [tag: string];
  search: [];
  "clear-tags": [];
}>();
</script>

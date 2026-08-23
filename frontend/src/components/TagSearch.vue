<template>
  <section class="tag-search" aria-label="Tag search">
    <div class="tag-input-row">
      <TagSuggestionInput
        input-id="tag-input"
        input-type="search"
        label="Search tags"
        placeholder="Type to find tags"
        selected-label="Selected tags"
        :available-tags="availableTags"
        :default-color="defaultColor"
        :selected-tags="selectedTags"
        :tag-colors="tagColors"
        @remove="$emit('remove-tag', $event)"
        @select="$emit('add-tag', $event)"
      />
    </div>

    <div v-if="selectedTags.length > 0" class="search-actions">
      <button class="secondary-button" type="button" @click="$emit('clear-tags')">
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
  tagColors?: Record<string, string>;
  defaultColor?: string;
}>();

defineEmits<{
  "add-tag": [tag: string];
  "remove-tag": [tag: string];
  "clear-tags": [];
}>();
</script>

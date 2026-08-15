<template>
  <section class="tag-editor" aria-label="Video tags">
    <TagSuggestionInput
      allow-create
      input-id="admin-tag-input"
      label="Add tag"
      placeholder="Add tag..."
      selected-label="Current tags"
      :available-tags="availableTags"
      :selected-tags="tags"
      @remove="removeTag"
      @select="addTag"
    />
  </section>
</template>

<script setup lang="ts">
import TagSuggestionInput from "./TagSuggestionInput.vue";

const props = defineProps<{
  tags: string[];
  availableTags: string[];
}>();

const emit = defineEmits<{
  "update:tags": [tags: string[]];
}>();

function addTag(tag: string): void {
  if (props.tags.includes(tag)) {
    return;
  }

  emit("update:tags", [...props.tags, tag]);
}

function removeTag(tag: string): void {
  emit(
    "update:tags",
    props.tags.filter((currentTag) => currentTag !== tag),
  );
}
</script>

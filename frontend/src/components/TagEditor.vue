<template>
  <section class="tag-editor" aria-label="Video tags">
    <TagSuggestionInput
      allow-create
      compact
      input-id="admin-tag-input"
      label="Add tag"
      placeholder="Add tag..."
      selected-label="Current tags"
      :available-tags="availableTags"
      :default-color="defaultColor"
      :selected-tags="tags"
      :disabled="disabled"
      :tag-colors="tagColors"
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
  tagColors?: Record<string, string>;
  defaultColor?: string;
  disabled?: boolean;
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

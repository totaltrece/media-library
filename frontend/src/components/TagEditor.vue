<template>
  <section class="tag-editor" aria-label="Video tags">
    <div class="selected-tags" aria-label="Current tags">
      <span v-for="tag in tags" :key="tag" class="tag-chip">
        {{ tag }}
        <button :aria-label="`Remove ${tag}`" type="button" @click="removeTag(tag)">×</button>
      </span>
    </div>

    <TagSuggestionInput
      allow-create
      input-id="admin-tag-input"
      label="Add tag"
      placeholder="Add tag..."
      :available-tags="availableTags"
      :selected-tags="tags"
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

<style scoped>
.tag-editor {
  display: grid;
  gap: 0.75rem;
}
</style>

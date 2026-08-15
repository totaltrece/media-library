<template>
  <section class="tag-editor" aria-label="Video tags">
    <div class="selected-tags" aria-label="Current tags">
      <span v-for="tag in tags" :key="tag" class="tag-chip">
        {{ tag }}
        <button :aria-label="`Remove ${tag}`" type="button" @click="removeTag(tag)">×</button>
      </span>
    </div>

    <div ref="tagInputWrapper" class="tag-input-wrapper">
      <label class="visually-hidden" for="admin-tag-input">Add tag</label>
      <input
        id="admin-tag-input"
        v-model="query"
        autocomplete="off"
        placeholder="Add tag..."
        type="text"
        @focus="openSuggestions"
        @keydown.enter.prevent="confirmQuery"
        @keydown.escape="closeSuggestions"
      />

      <ul v-if="showSuggestions" class="tag-suggestions">
        <li v-for="tag in filteredSuggestions" :key="tag">
          <button type="button" @click="addTag(tag)">
            {{ tag }}
          </button>
        </li>
        <li v-if="canCreateNewTag">
          <button data-testid="add-new-tag" type="button" @click="addTag(query)">
            Añadir nuevo tag
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  tags: string[];
  availableTags: string[];
}>();

const emit = defineEmits<{
  "update:tags": [tags: string[]];
}>();

const query = ref("");
const showSuggestions = ref(false);
const tagInputWrapper = ref<HTMLElement | null>(null);

const filteredSuggestions = computed(() => {
  const normalizedQuery = query.value.trim().toLowerCase();

  return props.availableTags.filter((tag) => {
    if (props.tags.includes(tag)) {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    return tag.toLowerCase().includes(normalizedQuery);
  });
});

const canCreateNewTag = computed(() => {
  const name = query.value.trim();

  if (name.length === 0 || props.tags.includes(name)) {
    return false;
  }

  return !props.availableTags.some((tag) => tag.toLowerCase() === name.toLowerCase());
});

function openSuggestions(): void {
  showSuggestions.value = true;
}

function closeSuggestions(): void {
  showSuggestions.value = false;
}

function addTag(tag: string): void {
  const normalized = tag.trim();

  if (normalized.length === 0 || props.tags.includes(normalized)) {
    query.value = "";
    showSuggestions.value = false;
    return;
  }

  emit("update:tags", [...props.tags, normalized]);
  query.value = "";
  showSuggestions.value = false;
}

function confirmQuery(): void {
  addTag(query.value);
}

function removeTag(tag: string): void {
  emit(
    "update:tags",
    props.tags.filter((currentTag) => currentTag !== tag),
  );
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

.tag-editor {
  display: grid;
  gap: 0.75rem;
}
</style>

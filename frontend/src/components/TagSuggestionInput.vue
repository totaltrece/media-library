<template>
  <div
    ref="tagInputWrapper"
    class="tag-input-wrapper tag-combobox"
    :style="{ '--tag-selector-ch': String(selectorWidthCh) }"
  >
    <label class="visually-hidden" :for="inputId">{{ label }}</label>
    <div class="tag-combobox-field" @click="focusInput">
      <div v-if="selectedTags.length > 0" class="selected-tags" :aria-label="selectedLabel">
        <span
          v-for="tag in selectedTags"
          :key="tag"
          :class="['tag-chip', { 'is-new': isNewTag(tag) }]"
        >
          {{ tag }}
          <button
            :aria-label="`Remove ${tag}`"
            type="button"
            @click.stop="removeTag(tag)"
          >
            ×
          </button>
        </span>
      </div>
      <input
        :id="inputId"
        ref="tagInput"
        v-model="query"
        autocomplete="off"
        class="tag-combobox-input"
        :placeholder="selectedTags.length === 0 ? placeholder : ''"
        :type="inputType"
        @focus="openSuggestions"
        @keydown="handleInputKeydown"
      />
    </div>

    <ul v-if="showSuggestions" class="tag-suggestions">
      <li v-for="(tag, index) in filteredSuggestions" :key="tag">
        <button
          type="button"
          :class="{ highlighted: highlightedIndex === index }"
          @click="selectTag(tag)"
        >
          {{ tag }}
        </button>
      </li>
      <li v-if="canCreateNewTag">
        <button
          data-testid="add-new-tag"
          type="button"
          :class="{ highlighted: highlightedIndex === filteredSuggestions.length }"
          @click="selectTag(query)"
        >
          Añadir nuevo tag
        </button>
      </li>
      <li v-else-if="filteredSuggestions.length === 0">
        <button disabled type="button">No matching tags</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    availableTags: string[];
    selectedTags: string[];
    inputId: string;
    label: string;
    placeholder: string;
    inputType?: "text" | "search";
    allowCreate?: boolean;
    selectedLabel?: string;
  }>(),
  {
    inputType: "text",
    allowCreate: false,
    selectedLabel: "Selected tags",
  },
);

const emit = defineEmits<{
  select: [tag: string];
  remove: [tag: string];
}>();

const query = ref("");
const showSuggestions = ref(false);
const highlightedIndex = ref(-1);
const tagInputWrapper = ref<HTMLElement | null>(null);
const tagInput = ref<HTMLInputElement | null>(null);

const selectorWidthCh = computed(() => {
  const names = [...props.availableTags, ...props.selectedTags];
  const longest = names.reduce((max, tag) => Math.max(max, tag.length), 0);

  return Math.max(longest, 8);
});

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

const canCreateNewTag = computed(() => {
  if (!props.allowCreate) {
    return false;
  }

  const name = query.value.trim();

  if (name.length === 0 || props.selectedTags.includes(name)) {
    return false;
  }

  return !props.availableTags.some((tag) => tag.toLowerCase() === name.toLowerCase());
});

const suggestionCount = computed(
  () => filteredSuggestions.value.length + (canCreateNewTag.value ? 1 : 0),
);

watch(query, () => {
  highlightedIndex.value = -1;
});

function isNewTag(tag: string): boolean {
  if (!props.allowCreate) {
    return false;
  }

  return !props.availableTags.some((availableTag) => availableTag.toLowerCase() === tag.toLowerCase());
}

function focusInput(): void {
  tagInput.value?.focus();
}

function openSuggestions(): void {
  showSuggestions.value = true;
}

function closeSuggestions(): void {
  showSuggestions.value = false;
  highlightedIndex.value = -1;
}

function highlightedTag(): string | undefined {
  if (highlightedIndex.value < 0) {
    return undefined;
  }

  if (highlightedIndex.value < filteredSuggestions.value.length) {
    return filteredSuggestions.value[highlightedIndex.value];
  }

  if (canCreateNewTag.value && highlightedIndex.value === filteredSuggestions.value.length) {
    return query.value;
  }

  return undefined;
}

function highlightNext(): void {
  const count = suggestionCount.value;

  if (count === 0) {
    return;
  }

  openSuggestions();
  highlightedIndex.value = (highlightedIndex.value + 1) % count;
  void scrollHighlightedIntoView();
}

function highlightPrevious(): void {
  const count = suggestionCount.value;

  if (count === 0) {
    return;
  }

  openSuggestions();
  highlightedIndex.value = highlightedIndex.value <= 0 ? count - 1 : highlightedIndex.value - 1;
  void scrollHighlightedIntoView();
}

async function scrollHighlightedIntoView(): Promise<void> {
  await nextTick();

  const highlighted = tagInputWrapper.value?.querySelector(".tag-suggestions button.highlighted");

  if (highlighted instanceof HTMLElement && typeof highlighted.scrollIntoView === "function") {
    highlighted.scrollIntoView({ block: "nearest" });
  }
}

function selectTag(tag: string): void {
  const normalized = tag.trim();

  if (normalized.length === 0 || props.selectedTags.includes(normalized)) {
    query.value = "";
    closeSuggestions();
    return;
  }

  emit("select", normalized);
  query.value = "";
  highlightedIndex.value = -1;
  showSuggestions.value = true;
  void nextTick(() => focusInput());
}

function removeTag(tag: string): void {
  emit("remove", tag);
  focusInput();
}

function confirmQuery(): void {
  const highlighted = highlightedTag();

  if (highlighted !== undefined) {
    selectTag(highlighted);
    return;
  }

  if (props.allowCreate) {
    selectTag(query.value);
    return;
  }

  const firstSuggestion = filteredSuggestions.value[0];

  if (firstSuggestion !== undefined) {
    selectTag(firstSuggestion);
  }
}

function handleInputKeydown(event: KeyboardEvent): void {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlightNext();
    return;
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    highlightPrevious();
    return;
  }

  if (event.key === "Enter") {
    event.preventDefault();
    confirmQuery();
    return;
  }

  if (event.key === "Escape") {
    closeSuggestions();
  }
}

function handleDocumentPointerDown(event: Event): void {
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
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
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

.tag-combobox {
  display: block;
  width: 100%;
}

.tag-combobox-field {
  align-items: center;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 0.75rem;
  cursor: text;
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  min-height: 2.75rem;
  padding: 0.375rem 0.5rem;
  width: 100%;
}

.tag-combobox-field:focus-within {
  border-color: #1a73e8;
}

.tag-combobox-field .selected-tags {
  display: contents;
}

.tag-combobox-input {
  background: transparent;
  border: 0;
  flex: 1 1 8ch;
  font-size: 1rem;
  min-width: 8ch;
  padding: 0.375rem 0.25rem;
}

.tag-combobox-input:focus {
  outline: none;
}

.tag-suggestions {
  font-size: 0.875rem;
  padding: 0.125rem;
  width: calc(var(--tag-selector-ch, 8) * 1ch + 2.5rem);
}

.tag-suggestions button {
  padding: 0.3125rem 0.5rem;
}
</style>

<template>
  <div ref="root" class="type-select">
    <button
      :id="id"
      type="button"
      class="type-select-trigger"
      :aria-controls="listId"
      :aria-expanded="open"
      aria-haspopup="listbox"
      data-testid="edit-tag-type"
      @click="toggle"
    >
      <span
        v-if="selected"
        class="type-select-swatch"
        :style="{ backgroundColor: selected.color }"
      />
      <span>{{ selected?.name ?? "Select type" }}</span>
    </button>
    <ul
      v-if="open"
      :id="listId"
      class="tag-suggestions type-select-list"
      role="listbox"
    >
      <li v-for="type in types" :key="type.id">
        <button
          type="button"
          role="option"
          :aria-selected="type.id === modelValue"
          :class="{ highlighted: type.id === modelValue }"
          :data-testid="`tag-type-option-${type.name}`"
          @click="choose(type.id)"
        >
          <span class="type-select-swatch" :style="{ backgroundColor: type.color }" />
          {{ type.name }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";

const props = defineProps<{
  id: string;
  modelValue: number;
  types: Array<{ id: number; name: string; color: string }>;
}>();

const emit = defineEmits<{
  "update:modelValue": [id: number];
}>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);
const listId = computed(() => `${props.id}-list`);
const selected = computed(
  () => props.types.find((type) => type.id === props.modelValue) ?? null,
);

function toggle(): void {
  open.value = !open.value;
}

function choose(typeId: number): void {
  emit("update:modelValue", typeId);
  open.value = false;
}

function handleDocumentPointerDown(event: Event): void {
  if (!open.value) {
    return;
  }

  const target = event.target;

  if (target instanceof Node && root.value?.contains(target)) {
    return;
  }

  open.value = false;
}

onMounted(() => {
  document.addEventListener("pointerdown", handleDocumentPointerDown);
});

onUnmounted(() => {
  document.removeEventListener("pointerdown", handleDocumentPointerDown);
});
</script>

<style scoped>
.type-select {
  position: relative;
}

.type-select-trigger {
  align-items: center;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 0.5rem;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 0.875rem;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
  width: 100%;
}

.type-select-trigger:hover,
.type-select-trigger:focus-visible {
  border-color: #1a73e8;
}

.type-select-list {
  width: 100%;
}

.type-select-list :deep(button) {
  align-items: center;
  display: inline-flex;
  gap: 0.5rem;
  padding: 0.3125rem 0.5rem;
}

.type-select-swatch {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  flex-shrink: 0;
  height: 1.25rem;
  width: 1.25rem;
}
</style>

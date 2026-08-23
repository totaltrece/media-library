<template>
  <div class="app-shell">
    <AppHeader
      title="Tag types"
      subtitle="Add, rename, or recolor the types used by catalog tags."
      @refreshed="loadTypes"
    />

    <LoadingIndicator v-if="loading" message="Loading tag types..." />
    <ErrorMessage v-else-if="error" :message="error" />

    <template v-else>
      <form class="tag-type-create" @submit.prevent="addType">
        <label class="visually-hidden" for="new-tag-type-name">New type name</label>
        <input
          id="new-tag-type-name"
          v-model="createName"
          autocomplete="off"
          placeholder="New type name"
          type="text"
        />
        <ColorPickerField v-model="createColor" />
        <button class="primary-button" data-testid="add-tag-type" type="button" :disabled="saving" @click="addType">
          Add type
        </button>
      </form>

      <ErrorMessage v-if="actionError" :message="actionError" />

      <ul class="tag-type-list" aria-label="Tag types">
        <li v-for="type in types" :key="type.id" class="tag-type-item">
          <span class="tag-type-swatch" :style="{ backgroundColor: type.color }" />
          <span class="tag-type-name">{{ type.name }}</span>
          <span class="tag-type-meta">
            {{ type.tagCount }} tag{{ type.tagCount === 1 ? "" : "s" }}
            <template v-if="type.isDefault"> · default</template>
          </span>
          <button
            :aria-label="`Edit ${type.name}`"
            class="admin-tag-action"
            type="button"
            @click="startEdit(type)"
          >
            Edit
          </button>
          <button
            v-if="!type.isDefault"
            :aria-label="`Delete ${type.name}`"
            class="admin-tag-action admin-tag-action-danger"
            type="button"
            :disabled="type.tagCount > 0"
            :title="type.tagCount > 0 ? 'Remove tags from this type before deleting it.' : `Delete ${type.name}`"
            @click="askDelete(type)"
          >
            Delete
          </button>
        </li>
      </ul>
    </template>

    <div
      v-if="editingType"
      class="video-modal-backdrop"
      role="presentation"
      @click.self="cancelEdit"
    >
      <div
        class="admin-tag-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-tag-type-title"
      >
        <p id="edit-tag-type-title">Edit type</p>
        <label class="admin-tag-field" for="edit-tag-type-name">Name</label>
        <input
          id="edit-tag-type-name"
          v-model="editName"
          autocomplete="off"
          type="text"
          @keydown.escape="cancelEdit"
        />
        <p class="admin-tag-field">Color</p>
        <ColorPickerField v-model="editColor" />
        <div class="search-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="cancelEdit">
            Cancel
          </button>
          <button
            class="primary-button"
            data-testid="save-tag-type"
            type="button"
            :disabled="saving"
            @click="saveEdit"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="confirmingType"
      class="video-modal-backdrop"
      role="presentation"
      @click.self="cancelDelete"
    >
      <div
        class="admin-tag-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-tag-type-title"
      >
        <p id="delete-tag-type-title">Delete the type "{{ confirmingType.name }}"?</p>
        <p>This type has no tags assigned.</p>
        <div class="search-actions">
          <button class="secondary-button" type="button" @click="cancelDelete">Cancel</button>
          <button
            class="primary-button"
            data-testid="confirm-delete-tag-type"
            type="button"
            :disabled="saving"
            @click="confirmDelete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import { createTagType, deleteTagType, fetchTagTypes, updateTagType } from "../api/client.js";
import type { TagType } from "../api/types.js";
import AppHeader from "../components/AppHeader.vue";
import ColorPickerField from "../components/ColorPickerField.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import { DEFAULT_TAG_COLOR } from "../utils/tag-color.js";

const types = ref<TagType[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const createName = ref("");
const createColor = ref(DEFAULT_TAG_COLOR);
const editingId = ref<number | null>(null);
const confirmingId = ref<number | null>(null);
const editName = ref("");
const editColor = ref(DEFAULT_TAG_COLOR);

const editingType = computed(
  () => types.value.find((type) => type.id === editingId.value) ?? null,
);

const confirmingType = computed(
  () => types.value.find((type) => type.id === confirmingId.value) ?? null,
);

onMounted(async () => {
  await loadTypes();
});

async function loadTypes(): Promise<void> {
  loading.value = true;

  try {
    const response = await fetchTagTypes();
    types.value = response.types;
    error.value = null;
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load tag types.";
  } finally {
    loading.value = false;
  }
}

async function addType(): Promise<void> {
  saving.value = true;
  actionError.value = null;

  try {
    const created = await createTagType(createName.value, createColor.value);
    types.value = [...types.value, created];
    createName.value = "";
    createColor.value = DEFAULT_TAG_COLOR;
  } catch (createError: unknown) {
    actionError.value = createError instanceof Error ? createError.message : "Unable to add tag type.";
  } finally {
    saving.value = false;
  }
}

function startEdit(type: TagType): void {
  editingId.value = type.id;
  confirmingId.value = null;
  editName.value = type.name;
  editColor.value = type.color;
  actionError.value = null;
}

function cancelEdit(): void {
  editingId.value = null;
}

async function saveEdit(): Promise<void> {
  if (editingId.value === null) {
    return;
  }

  const typeId = editingId.value;
  saving.value = true;
  actionError.value = null;

  try {
    const updated = await updateTagType(typeId, editName.value, editColor.value);
    types.value = types.value.map((type) => (type.id === typeId ? updated : type));
    cancelEdit();
  } catch (saveError: unknown) {
    actionError.value = saveError instanceof Error ? saveError.message : "Unable to update tag type.";
  } finally {
    saving.value = false;
  }
}

function askDelete(type: TagType): void {
  if (type.isDefault || type.tagCount > 0) {
    return;
  }

  confirmingId.value = type.id;
  editingId.value = null;
  actionError.value = null;
}

function cancelDelete(): void {
  confirmingId.value = null;
}

async function confirmDelete(): Promise<void> {
  if (confirmingId.value === null) {
    return;
  }

  const typeId = confirmingId.value;
  saving.value = true;
  actionError.value = null;

  try {
    await deleteTagType(typeId);
    types.value = types.value.filter((type) => type.id !== typeId);
    confirmingId.value = null;
  } catch (deleteError: unknown) {
    actionError.value = deleteError instanceof Error ? deleteError.message : "Unable to delete tag type.";
  } finally {
    saving.value = false;
  }
}
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

.tag-type-create {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.tag-type-create input {
  border: 1px solid #dadce0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

.tag-type-list {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.tag-type-item {
  align-items: center;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem 1rem;
}

.tag-type-swatch {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 999px;
  height: 1.25rem;
  width: 1.25rem;
}

.tag-type-name {
  font-weight: 600;
}

.tag-type-meta {
  color: #5f6368;
  flex: 1 1 auto;
  font-size: 0.875rem;
}

.admin-tag-action {
  background: transparent;
  border: 0;
  color: #174ea6;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
}

.admin-tag-action:disabled {
  color: #9aa0a6;
  cursor: not-allowed;
}

.admin-tag-action-danger {
  color: #a50e0e;
}

.admin-tag-confirm-modal {
  background: #fff;
  border-radius: 1rem;
  display: grid;
  gap: 0.75rem;
  max-width: 22rem;
  padding: 1.25rem;
  width: 100%;
}

.admin-tag-confirm-modal p {
  margin: 0;
}

.admin-tag-confirm-modal p:first-child {
  font-weight: 600;
}

.admin-tag-field {
  font-size: 0.875rem;
  font-weight: 600;
}

.admin-tag-confirm-modal input {
  border: 1px solid #dadce0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}
</style>

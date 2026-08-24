<template>
  <div class="app-shell">
    <AppHeader
      title="Tag catalog"
      subtitle="Rename or delete tags used across the library."
      @refreshed="onLibraryRefreshed"
    />

    <LoadingIndicator v-if="loading" message="Loading tags..." />
    <ErrorMessage v-else-if="error" :message="error" />

    <template v-else>
      <div class="admin-tag-toolbar">
        <div class="tag-input-wrapper">
          <label class="visually-hidden" for="catalog-tag-filter">Search tags</label>
          <input
            id="catalog-tag-filter"
            v-model="filterQuery"
            autocomplete="off"
            placeholder="Search tags..."
            type="search"
          />
        </div>
        <div class="admin-tag-sort" role="group" aria-label="Sort tags">
          <button
            class="secondary-button"
            type="button"
            data-testid="sort-name"
            :class="{ active: sort === 'name-asc' || sort === 'name-desc' }"
            :aria-pressed="sort === 'name-asc' || sort === 'name-desc'"
            :aria-label="sort === 'name-desc' ? 'Sort Z to A' : 'Sort A to Z'"
            @click="toggleNameSort"
          >
            A-Z{{ sort === "name-desc" ? " ↑" : sort === "name-asc" ? " ↓" : "" }}
          </button>
          <button
            class="secondary-button"
            type="button"
            data-testid="sort-usage"
            :class="{ active: sort === 'usage-desc' || sort === 'usage-asc' }"
            :aria-pressed="sort === 'usage-desc' || sort === 'usage-asc'"
            :aria-label="sort === 'usage-asc' ? 'Sort by usage, least used first' : 'Sort by usage, most used first'"
            @click="toggleUsageSort"
          >
            Usage{{ sort === "usage-asc" ? " ↑" : sort === "usage-desc" ? " ↓" : "" }}
          </button>
          <button
            class="secondary-button"
            type="button"
            data-testid="sort-type"
            :class="{ active: sort === 'type-asc' || sort === 'type-desc' }"
            :aria-pressed="sort === 'type-asc' || sort === 'type-desc'"
            :aria-label="sort === 'type-desc' ? 'Sort by type, reverse order' : 'Sort by type'"
            @click="toggleTypeSort"
          >
            Type{{ sort === "type-desc" ? " ↑" : sort === "type-asc" ? " ↓" : "" }}
          </button>
        </div>
      </div>

      <p v-if="visibleTags.length === 0" class="status-message info">No matching tags.</p>

      <ul v-else class="admin-tag-catalog" aria-label="Tag catalog">
        <li
          v-for="tag in visibleTags"
          :key="tag.id"
          class="admin-tag-item"
          :style="tagChipStyle(tag.color)"
        >
          <RouterLink
            class="admin-tag-name"
            :aria-label="`View videos tagged ${tag.name}`"
            :title="`View videos tagged ${tag.name}`"
            :to="{ name: 'home', query: { tag: tag.name } }"
          >
            {{ tag.name }}
          </RouterLink>{{ " " }}<span class="admin-tag-count">({{ tag.usageCount }})</span>
          <button
            :aria-label="`Edit ${tag.name}`"
            :title="`Edit ${tag.name}`"
            class="admin-tag-action"
            type="button"
            @click="startEdit(tag)"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            :aria-label="`Delete ${tag.name}`"
            :title="`Delete ${tag.name}`"
            class="admin-tag-action admin-tag-action-danger"
            type="button"
            @click="askDelete(tag)"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M19 6v14H5V6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </li>
      </ul>
    </template>

    <ErrorMessage v-if="actionError" :message="actionError" />

    <div
      v-if="editingTag"
      class="video-modal-backdrop"
      role="presentation"
      @click.self="cancelEdit"
    >
      <div
        class="admin-tag-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-tag-title"
      >
        <p id="edit-tag-title">Edit tag</p>
        <label class="admin-tag-field" for="edit-tag-name">Name</label>
        <input
          id="edit-tag-name"
          v-model="editName"
          autocomplete="off"
          type="text"
          @keydown.enter.prevent="saveEdit"
          @keydown.escape="cancelEdit"
        />
        <label class="admin-tag-field" for="edit-tag-type">Type</label>
        <TagTypeSelect id="edit-tag-type" v-model="editTypeId" :types="types" />
        <div class="search-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="cancelEdit">
            Cancel
          </button>
          <button
            class="primary-button"
            data-testid="save-tag"
            type="button"
            :disabled="saving || !canWrite"
            @click="saveEdit"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="confirmingTag"
      class="video-modal-backdrop"
      role="presentation"
      @click.self="cancelDelete"
    >
      <div
        class="admin-tag-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-tag-title"
        aria-describedby="delete-tag-description"
      >
        <p id="delete-tag-title">Delete the tag "{{ confirmingTag.name }}"?</p>
        <p id="delete-tag-description">This will also remove it from every video that uses it.</p>
        <div class="search-actions">
          <button class="secondary-button" data-testid="cancel-delete-tag" type="button" @click="cancelDelete">
            Cancel
          </button>
          <button
            class="primary-button"
            data-testid="confirm-delete-tag"
            type="button"
            :disabled="saving || !canWrite"
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
import { computed, onMounted, ref, watch } from "vue";

import { deleteCatalogTag, fetchTagCatalog, fetchTagTypes, updateCatalogTag } from "../api/client.js";
import type { CatalogTag, TagType } from "../api/types.js";
import { useAuth } from "../auth/session.js";
import AppHeader from "../components/AppHeader.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";
import TagTypeSelect from "../components/TagTypeSelect.vue";
import { tagChipStyle } from "../utils/tag-color.js";

type TagSort = "name-asc" | "name-desc" | "usage-desc" | "usage-asc" | "type-asc" | "type-desc";

const tags = ref<CatalogTag[]>([]);
const { canWrite } = useAuth();
const types = ref<TagType[]>([]);
const filterQuery = ref("");
const sort = ref<TagSort>("name-asc");
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const editingId = ref<number | null>(null);
const confirmingId = ref<number | null>(null);
const editName = ref("");
const editTypeId = ref(0);

const confirmingTag = computed(
  () => tags.value.find((tag) => tag.id === confirmingId.value) ?? null,
);

const editingTag = computed(
  () => tags.value.find((tag) => tag.id === editingId.value) ?? null,
);

const visibleTags = computed(() => {
  const query = filterQuery.value.trim().toLowerCase();
  const filtered =
    query.length === 0
      ? [...tags.value]
      : tags.value.filter((tag) => tag.name.toLowerCase().includes(query));

  return filtered.sort((firstTag, secondTag) => {
    if (sort.value === "name-desc") {
      return secondTag.name.localeCompare(firstTag.name);
    }

    if (sort.value === "usage-desc") {
      return secondTag.usageCount - firstTag.usageCount || firstTag.name.localeCompare(secondTag.name);
    }

    if (sort.value === "usage-asc") {
      return firstTag.usageCount - secondTag.usageCount || firstTag.name.localeCompare(secondTag.name);
    }

    if (sort.value === "type-asc") {
      return firstTag.typeSortOrder - secondTag.typeSortOrder || firstTag.name.localeCompare(secondTag.name);
    }

    if (sort.value === "type-desc") {
      return secondTag.typeSortOrder - firstTag.typeSortOrder || firstTag.name.localeCompare(secondTag.name);
    }

    return firstTag.name.localeCompare(secondTag.name);
  });
});

function toggleNameSort(): void {
  sort.value = sort.value === "name-asc" ? "name-desc" : "name-asc";
}

function toggleUsageSort(): void {
  sort.value = sort.value === "usage-desc" ? "usage-asc" : "usage-desc";
}

function toggleTypeSort(): void {
  sort.value = sort.value === "type-asc" ? "type-desc" : "type-asc";
}

watch(filterQuery, () => {
  editingId.value = null;
  confirmingId.value = null;
  editName.value = "";
});

onMounted(async () => {
  await loadTags();
});

async function loadTags(): Promise<void> {
  loading.value = true;

  try {
    const [catalog, tagTypes] = await Promise.all([fetchTagCatalog(), fetchTagTypes()]);
    tags.value = catalog.tags;
    types.value = tagTypes.types;
    error.value = null;
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load tags.";
  } finally {
    loading.value = false;
  }
}

async function onLibraryRefreshed(): Promise<void> {
  await loadTags();
}

function startEdit(tag: CatalogTag): void {
  editingId.value = tag.id;
  confirmingId.value = null;
  editName.value = tag.name;
  editTypeId.value = tag.typeId;
  actionError.value = null;
}

function cancelEdit(): void {
  editingId.value = null;
  editName.value = "";
}

async function saveEdit(): Promise<void> {
  if (!canWrite.value || editingId.value === null) {
    return;
  }

  const tagId = editingId.value;
  saving.value = true;
  actionError.value = null;

  try {
    const updated = await updateCatalogTag(tagId, editName.value, editTypeId.value);
    tags.value = tags.value.map((tag) => (tag.id === tagId ? updated : tag));
    cancelEdit();
  } catch (saveError: unknown) {
    actionError.value = saveError instanceof Error ? saveError.message : "Unable to rename tag.";
  } finally {
    saving.value = false;
  }
}

function askDelete(tag: CatalogTag): void {
  confirmingId.value = tag.id;
  editingId.value = null;
  actionError.value = null;
}

function cancelDelete(): void {
  confirmingId.value = null;
}

async function confirmDelete(): Promise<void> {
  if (!canWrite.value || confirmingId.value === null) {
    return;
  }

  const tagId = confirmingId.value;
  saving.value = true;
  actionError.value = null;

  try {
    await deleteCatalogTag(tagId);
    tags.value = tags.value.filter((tag) => tag.id !== tagId);
    confirmingId.value = null;
  } catch (deleteError: unknown) {
    actionError.value = deleteError instanceof Error ? deleteError.message : "Unable to delete tag.";
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

.admin-tag-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.admin-tag-toolbar .tag-input-wrapper {
  flex: 0 1 16rem;
  max-width: 16rem;
  width: 100%;
}

.admin-tag-toolbar .tag-input-wrapper input {
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
}

.admin-tag-sort {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.admin-tag-sort .secondary-button {
  font-size: 0.75rem;
  padding: 0.375rem 0.625rem;
}

.admin-tag-sort .secondary-button.active {
  background: #1a73e8;
  color: #fff;
}

.admin-tag-catalog {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.admin-tag-item {
  align-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.125rem;
  padding: 0.125rem 0.125rem 0.125rem 0.5rem;
}

.admin-tag-name {
  color: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
}

.admin-tag-name:hover,
.admin-tag-name:focus-visible {
  text-decoration: underline;
}

.admin-tag-count {
  font-size: 0.75rem;
  font-weight: 500;
  opacity: 0.8;
  padding-right: 0.125rem;
}

.admin-tag-action {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  height: 1.25rem;
  justify-content: center;
  opacity: 0.75;
  padding: 0;
  text-decoration: none;
  width: 1.25rem;
}

.admin-tag-action:hover,
.admin-tag-action:focus-visible {
  background: rgba(255, 255, 255, 0.28);
  opacity: 1;
}

.admin-tag-action-danger:hover,
.admin-tag-action-danger:focus-visible {
  background: rgba(165, 14, 14, 0.16);
}

.admin-tag-action svg {
  display: block;
  height: 0.75rem;
  width: 0.75rem;
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

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="app-header-row">
        <div>
          <h1>Tag catalog</h1>
          <p>Rename or delete tags used across the library.</p>
        </div>
        <div class="search-actions">
          <AdminNav />
          <RouterLink class="secondary-button" to="/">Back to library</RouterLink>
        </div>
      </div>
    </header>

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
            placeholder="Buscar tags..."
            type="search"
          />
        </div>
        <div class="admin-tag-sort" role="group" aria-label="Ordenar tags">
          <button
            class="secondary-button"
            type="button"
            data-testid="sort-name"
            :class="{ active: sort === 'name-asc' || sort === 'name-desc' }"
            :aria-pressed="sort === 'name-asc' || sort === 'name-desc'"
            :aria-label="sort === 'name-desc' ? 'Ordenar de la Z a la A' : 'Ordenar de la A a la Z'"
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
            :aria-label="sort === 'usage-asc' ? 'Ordenar por usos, menos usados primero' : 'Ordenar por usos, más usados primero'"
            @click="toggleUsageSort"
          >
            Usos{{ sort === "usage-asc" ? " ↑" : sort === "usage-desc" ? " ↓" : "" }}
          </button>
        </div>
      </div>

      <p v-if="visibleTags.length === 0" class="status-message info">No matching tags.</p>

      <ul v-else class="admin-tag-catalog" aria-label="Tag catalog">
        <li v-for="tag in visibleTags" :key="tag.id" class="admin-tag-item">
          <template v-if="editingId === tag.id">
            <label class="visually-hidden" :for="`rename-tag-${tag.id}`">New tag name</label>
            <input
              :id="`rename-tag-${tag.id}`"
              v-model="editName"
              autocomplete="off"
              type="text"
              @keydown.enter.prevent="saveEdit"
              @keydown.escape="cancelEdit"
            />
            <button class="primary-button" data-testid="save-tag" type="button" :disabled="saving" @click="saveEdit">
              Guardar
            </button>
            <button class="secondary-button" type="button" :disabled="saving" @click="cancelEdit">Cancelar</button>
          </template>
          <template v-else>
            <RouterLink
              class="admin-tag-name"
              :aria-label="`Ver vídeos con ${tag.name}`"
              :title="`Ver vídeos con ${tag.name}`"
              :to="{ name: 'admin-videos', query: { tag: tag.name } }"
            >
              {{ tag.name }}
            </RouterLink>{{ " " }}<span class="admin-tag-count">({{ tag.usageCount }})</span>
            <button
              :aria-label="`Editar ${tag.name}`"
              :title="`Editar ${tag.name}`"
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
              :aria-label="`Eliminar ${tag.name}`"
              :title="`Eliminar ${tag.name}`"
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
          </template>
        </li>
      </ul>
    </template>

    <ErrorMessage v-if="actionError" :message="actionError" />

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
        <p id="delete-tag-title">¿Eliminar el tag "{{ confirmingTag.name }}"?</p>
        <p id="delete-tag-description">Se eliminará también su relación con todos los vídeos que lo utilizan.</p>
        <div class="search-actions">
          <button class="secondary-button" data-testid="cancel-delete-tag" type="button" @click="cancelDelete">
            Cancelar
          </button>
          <button
            class="primary-button"
            data-testid="confirm-delete-tag"
            type="button"
            :disabled="saving"
            @click="confirmDelete"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import { deleteCatalogTag, fetchTagCatalog, renameCatalogTag } from "../api/client.js";
import type { CatalogTag } from "../api/types.js";
import AdminNav from "../components/AdminNav.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";

type TagSort = "name-asc" | "name-desc" | "usage-desc" | "usage-asc";

const tags = ref<CatalogTag[]>([]);
const filterQuery = ref("");
const sort = ref<TagSort>("name-asc");
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const editingId = ref<number | null>(null);
const confirmingId = ref<number | null>(null);
const editName = ref("");

const confirmingTag = computed(
  () => tags.value.find((tag) => tag.id === confirmingId.value) ?? null,
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

    return firstTag.name.localeCompare(secondTag.name);
  });
});

function toggleNameSort(): void {
  sort.value = sort.value === "name-asc" ? "name-desc" : "name-asc";
}

function toggleUsageSort(): void {
  sort.value = sort.value === "usage-desc" ? "usage-asc" : "usage-desc";
}

watch(filterQuery, () => {
  editingId.value = null;
  confirmingId.value = null;
  editName.value = "";
});

onMounted(async () => {
  try {
    const response = await fetchTagCatalog();
    tags.value = response.tags;
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load tags.";
  } finally {
    loading.value = false;
  }
});

function startEdit(tag: CatalogTag): void {
  editingId.value = tag.id;
  confirmingId.value = null;
  editName.value = tag.name;
  actionError.value = null;
}

function cancelEdit(): void {
  editingId.value = null;
  editName.value = "";
}

async function saveEdit(): Promise<void> {
  if (editingId.value === null) {
    return;
  }

  const tagId = editingId.value;
  saving.value = true;
  actionError.value = null;

  try {
    const updated = await renameCatalogTag(tagId, editName.value);
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
  if (confirmingId.value === null) {
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
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 999px;
  display: flex;
  flex-wrap: nowrap;
  gap: 0.125rem;
  padding: 0.125rem 0.125rem 0.125rem 0.5rem;
}

.admin-tag-name {
  color: #174ea6;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
}

.admin-tag-name:hover,
.admin-tag-name:focus-visible {
  color: #0b3d91;
  text-decoration: underline;
}

.admin-tag-count {
  color: #7d8ea3;
  font-size: 0.75rem;
  font-weight: 500;
  padding-right: 0.125rem;
}

.admin-tag-item input {
  border: 1px solid #dadce0;
  border-radius: 999px;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.admin-tag-item .primary-button,
.admin-tag-item .secondary-button {
  font-size: 0.75rem;
  padding: 0.25rem 0.625rem;
}

.admin-tag-action {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: #5f6368;
  cursor: pointer;
  display: inline-flex;
  height: 1.25rem;
  justify-content: center;
  padding: 0;
  text-decoration: none;
  width: 1.25rem;
}

.admin-tag-action:hover,
.admin-tag-action:focus-visible {
  background: #e8f0fe;
  color: #174ea6;
}

.admin-tag-action-danger:hover,
.admin-tag-action-danger:focus-visible {
  background: #fce8e6;
  color: #a50e0e;
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
</style>

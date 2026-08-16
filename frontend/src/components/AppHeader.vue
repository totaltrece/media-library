<template>
  <header class="app-header">
    <div class="app-header-row">
      <div>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
      </div>
      <nav class="app-nav" aria-label="Main">
        <template v-for="(item, index) in items" :key="item.id">
          <span v-if="index > 0" class="app-nav-sep" aria-hidden="true">|</span>
          <RouterLink
            class="app-nav-link"
            :data-testid="item.testId"
            :class="{ active: current === item.id }"
            :aria-current="current === item.id ? 'page' : undefined"
            :to="item.to"
          >
            {{ item.label }}
          </RouterLink>
        </template>
        <span class="app-nav-sep" aria-hidden="true">|</span>
        <button
          class="refresh-button"
          type="button"
          aria-label="Refresh library"
          title="Refresh library"
          :aria-busy="refreshing"
          :disabled="refreshing"
          @click="refreshLibrary"
        >
          <svg aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 1 1-3.16-6.85" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </nav>
    </div>
    <ErrorMessage v-if="refreshError" :message="refreshError" />
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";

import { refreshLibrary as refreshLibraryIndex } from "../api/client.js";
import ErrorMessage from "./ErrorMessage.vue";

defineProps<{
  title: string;
  subtitle: string;
}>();

const emit = defineEmits<{
  refreshed: [];
}>();

const items = [
  { id: "view", to: "/", label: "View", testId: "nav-view" },
  { id: "upload", to: "/admin/videos/upload", label: "Upload video", testId: "upload-new-video" },
  { id: "tags", to: "/admin/tags", label: "Admin tags", testId: "nav-tags" },
] as const;

const route = useRoute();
const refreshing = ref(false);
const refreshError = ref<string | null>(null);

const current = computed(() => {
  switch (route.name) {
    case "home":
    case "admin-video-edit":
      return "view";
    case "admin-video-upload":
      return "upload";
    case "admin-tags":
      return "tags";
    default:
      return null;
  }
});

async function refreshLibrary(): Promise<void> {
  if (refreshing.value) {
    return;
  }

  refreshing.value = true;
  refreshError.value = null;

  try {
    await refreshLibraryIndex();
    emit("refreshed");
  } catch (error: unknown) {
    refreshError.value = error instanceof Error ? error.message : "Unable to refresh the media library.";
  } finally {
    refreshing.value = false;
  }
}
</script>

<style scoped>
.app-nav {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0;
}

.app-nav-sep {
  color: #80868b;
  padding: 0 0.45rem;
}

.app-nav-link {
  border-radius: 0.25rem;
  color: #3c4043;
  padding: 0.25rem 0.4rem;
  text-decoration: none;
}

.app-nav-link:hover,
.app-nav-link:focus-visible {
  background: #f1f3f4;
}

.app-nav-link.active {
  background: #e8f0fe;
  color: #174ea6;
  font-weight: 600;
}

.app-nav-link.active:hover,
.app-nav-link.active:focus-visible {
  background: #d2e3fc;
}

.refresh-button {
  background: transparent;
}

.refresh-button:hover,
.refresh-button:focus-visible {
  background: #f1f3f4;
}
</style>

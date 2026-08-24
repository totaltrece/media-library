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
        <template v-if="username">
          <span class="auth-username" data-testid="auth-username">{{ username }}</span>
          <span class="app-nav-sep" aria-hidden="true">|</span>
          <button
            class="app-nav-link auth-button"
            data-testid="auth-logout"
            type="button"
            :disabled="authBusy"
            @click="onLogout"
          >
            Log out
          </button>
        </template>
        <button
          v-else
          class="app-nav-link auth-button"
          data-testid="auth-login"
          type="button"
          @click="openLogin"
        >
          Log in
        </button>
        <span class="app-nav-sep" aria-hidden="true">|</span>
        <button
          class="refresh-button"
          type="button"
          aria-label="Refresh library"
          title="Refresh library"
          :aria-busy="refreshing"
          :disabled="refreshing || !canWrite"
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
    <ErrorMessage v-if="authError && !loginOpen" :message="authError" />
  </header>

  <div
    v-if="loginOpen"
    class="video-modal-backdrop"
    role="presentation"
    @click.self="closeLogin"
  >
    <form
      class="login-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-title"
      @submit.prevent="onLogin"
    >
      <p id="login-title">Log in</p>
      <label class="login-field" for="login-username">Username</label>
      <input
        id="login-username"
        v-model="loginUsername"
        autocomplete="username"
        data-testid="login-username"
        type="text"
      />
      <label class="login-field" for="login-password">Password</label>
      <input
        id="login-password"
        v-model="loginPassword"
        autocomplete="current-password"
        data-testid="login-password"
        type="password"
      />
      <ErrorMessage v-if="authError" :message="authError" />
      <div class="search-actions">
        <button class="secondary-button" type="button" :disabled="authBusy" @click="closeLogin">
          Cancel
        </button>
        <button
          class="primary-button"
          data-testid="login-submit"
          type="submit"
          :disabled="authBusy"
        >
          Log in
        </button>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";

import { refreshLibrary as refreshLibraryIndex } from "../api/client.js";
import { useAuth } from "../auth/session.js";
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
  { id: "tag-types", to: "/admin/tag-types", label: "Tag types", testId: "nav-tag-types" },
] as const;

const route = useRoute();
const { canWrite, username, load, login, logout } = useAuth();
const refreshing = ref(false);
const refreshError = ref<string | null>(null);
const loginOpen = ref(false);
const loginUsername = ref("");
const loginPassword = ref("");
const authBusy = ref(false);
const authError = ref<string | null>(null);

const current = computed(() => {
  switch (route.name) {
    case "home":
    case "admin-video-edit":
      return "view";
    case "admin-video-upload":
      return "upload";
    case "admin-tags":
      return "tags";
    case "admin-tag-types":
      return "tag-types";
    default:
      return null;
  }
});

onMounted(() => {
  void load();
});

function openLogin(): void {
  loginOpen.value = true;
  loginUsername.value = "";
  loginPassword.value = "";
  authError.value = null;
}

function closeLogin(): void {
  if (authBusy.value) {
    return;
  }

  loginOpen.value = false;
}

async function onLogin(): Promise<void> {
  if (authBusy.value) {
    return;
  }

  authBusy.value = true;
  authError.value = null;

  try {
    await login(loginUsername.value, loginPassword.value);
    loginOpen.value = false;
  } catch (error: unknown) {
    authError.value = error instanceof Error ? error.message : "Unable to log in.";
  } finally {
    authBusy.value = false;
  }
}

async function onLogout(): Promise<void> {
  if (authBusy.value) {
    return;
  }

  authBusy.value = true;
  authError.value = null;

  try {
    await logout();
  } catch (error: unknown) {
    authError.value = error instanceof Error ? error.message : "Unable to log out.";
  } finally {
    authBusy.value = false;
  }
}

async function refreshLibrary(): Promise<void> {
  if (!canWrite.value || refreshing.value) {
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
  background: transparent;
  border: 0;
  border-radius: 0.25rem;
  color: #3c4043;
  cursor: pointer;
  font: inherit;
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

.auth-username {
  color: #3c4043;
  font-weight: 600;
  padding: 0.25rem 0.15rem;
}

.refresh-button {
  background: transparent;
}

.refresh-button:hover,
.refresh-button:focus-visible {
  background: #f1f3f4;
}

.login-modal {
  background: #fff;
  border-radius: 0.75rem;
  box-shadow: 0 8px 32px rgb(0 0 0 / 18%);
  display: grid;
  gap: 0.5rem;
  max-width: 22rem;
  padding: 1.25rem;
  width: min(22rem, calc(100vw - 2rem));
}

.login-modal p:first-child {
  font-weight: 600;
  margin: 0 0 0.25rem;
}

.login-field {
  font-size: 0.8125rem;
  font-weight: 600;
}

.login-modal input {
  border: 1px solid #dadce0;
  border-radius: 0.5rem;
  font: inherit;
  padding: 0.5rem 0.75rem;
}
</style>

<template>
  <div class="app-shell">
    <AppHeader
      title="Admin zone"
      subtitle="Manage view users and write a MariaDB catalog snapshot to the SQLite file."
    />

    <section class="admin-zone-section" aria-labelledby="admin-users-heading">
      <h2 id="admin-users-heading">Admin users</h2>
      <p class="admin-zone-copy">Create and remove view-only accounts. Admin accounts stay on the CLI.</p>

      <LoadingIndicator v-if="loading" message="Loading users..." />
      <ErrorMessage v-else-if="error" :message="error" />

      <template v-else>
        <form class="user-create" @submit.prevent="addUser">
          <label class="visually-hidden" for="new-user-username">Username</label>
          <input
            id="new-user-username"
            v-model="createUsername"
            autocomplete="off"
            data-testid="new-user-username"
            placeholder="Username"
            type="text"
          />
          <label class="visually-hidden" for="new-user-password">Password</label>
          <input
            id="new-user-password"
            v-model="createPassword"
            autocomplete="new-password"
            data-testid="new-user-password"
            placeholder="Password"
            type="password"
          />
          <button class="primary-button" data-testid="add-user" type="submit" :disabled="saving">
            Add view user
          </button>
        </form>

        <ErrorMessage v-if="actionError" :message="actionError" />

        <p v-if="users.length === 0" class="status-message info">No view users yet.</p>

        <ul v-else class="user-list" aria-label="View users">
          <li v-for="user in users" :key="user.id" class="user-item">
            <span class="user-name">{{ user.username }}</span>
            <span class="user-role">{{ user.role }}</span>
            <button
              :aria-label="`Delete ${user.username}`"
              class="danger-button"
              data-testid="delete-user"
              type="button"
              :disabled="saving"
              @click="askDelete(user)"
            >
              Delete
            </button>
          </li>
        </ul>
      </template>
    </section>

    <section class="admin-zone-section" aria-labelledby="backup-db-heading">
      <h2 id="backup-db-heading">Backup db</h2>
      <p class="admin-zone-copy">
        Copies tag types, tags, videos, relations, and users (including password hashes) from
        MariaDB into <code>SQLITE_PATH</code>. Sessions are not copied. The live app keeps using
        MariaDB. This is unavailable while the app itself is running on SQLite.
      </p>

      <ErrorMessage v-if="backupError" :message="backupError" />

      <button
        class="primary-button backup-button"
        data-testid="create-backup"
        type="button"
        :disabled="backupSaving"
        @click="runBackup"
      >
        Create backup
      </button>

      <p v-if="backupResult" class="status-message info" data-testid="backup-result">
        Wrote {{ backupResult.videos }} videos, {{ backupResult.tags }} tags,
        {{ backupResult.relations }} relations, {{ backupResult.users }} users, and
        {{ backupResult.tagTypes }} tag types to {{ backupResult.sqlitePath }}.
      </p>
    </section>

    <div
      v-if="confirmingUser"
      class="video-modal-backdrop"
      role="presentation"
      @click.self="cancelDelete"
    >
      <div class="admin-video-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
        <p id="delete-user-title">Delete {{ confirmingUser.username }}?</p>
        <p>This view account will be removed. Open sessions for that user will end.</p>
        <div class="search-actions">
          <button class="secondary-button" type="button" :disabled="saving" @click="cancelDelete">
            Cancel
          </button>
          <button
            class="danger-button"
            data-testid="confirm-delete-user"
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
import { onMounted, ref } from "vue";

import { createCatalogBackup, createManagedUser, deleteManagedUser, fetchManagedUsers } from "../api/client.js";
import type { CatalogBackupResult, ManagedUser } from "../api/types.js";
import AppHeader from "../components/AppHeader.vue";
import ErrorMessage from "../components/ErrorMessage.vue";
import LoadingIndicator from "../components/LoadingIndicator.vue";

const users = ref<ManagedUser[]>([]);
const loading = ref(true);
const saving = ref(false);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const createUsername = ref("");
const createPassword = ref("");
const confirmingUser = ref<ManagedUser | null>(null);
const backupSaving = ref(false);
const backupError = ref<string | null>(null);
const backupResult = ref<CatalogBackupResult | null>(null);

onMounted(() => {
  void loadUsers();
});

async function loadUsers(): Promise<void> {
  loading.value = true;
  error.value = null;

  try {
    users.value = (await fetchManagedUsers()).users;
  } catch (loadError: unknown) {
    error.value = loadError instanceof Error ? loadError.message : "Unable to load users.";
  } finally {
    loading.value = false;
  }
}

async function addUser(): Promise<void> {
  if (saving.value) {
    return;
  }

  saving.value = true;
  actionError.value = null;

  try {
    const created = await createManagedUser(createUsername.value, createPassword.value);
    users.value = [...users.value, created].sort((left, right) => left.username.localeCompare(right.username));
    createUsername.value = "";
    createPassword.value = "";
  } catch (createError: unknown) {
    actionError.value = createError instanceof Error ? createError.message : "Unable to create user.";
  } finally {
    saving.value = false;
  }
}

function askDelete(user: ManagedUser): void {
  confirmingUser.value = user;
}

function cancelDelete(): void {
  if (!saving.value) {
    confirmingUser.value = null;
  }
}

async function confirmDelete(): Promise<void> {
  const user = confirmingUser.value;

  if (user === null || saving.value) {
    return;
  }

  saving.value = true;
  actionError.value = null;

  try {
    await deleteManagedUser(user.id);
    users.value = users.value.filter((item) => item.id !== user.id);
    confirmingUser.value = null;
  } catch (deleteError: unknown) {
    actionError.value = deleteError instanceof Error ? deleteError.message : "Unable to delete user.";
  } finally {
    saving.value = false;
  }
}

async function runBackup(): Promise<void> {
  if (backupSaving.value) {
    return;
  }

  backupSaving.value = true;
  backupError.value = null;
  backupResult.value = null;

  try {
    backupResult.value = await createCatalogBackup();
  } catch (createError: unknown) {
    backupError.value = createError instanceof Error ? createError.message : "Unable to create the SQLite backup.";
  } finally {
    backupSaving.value = false;
  }
}
</script>

<style scoped>
.admin-zone-section {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.admin-zone-section h2 {
  font-size: 1.125rem;
  margin: 0;
}

.admin-zone-copy {
  color: #5f6368;
  margin: 0;
}

.backup-button {
  justify-self: start;
  width: max-content;
}

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

.user-create {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.user-create input {
  border: 1px solid #dadce0;
  border-radius: 0.5rem;
  flex: 1 1 10rem;
  font: inherit;
  padding: 0.5rem 0.75rem;
}

.user-list {
  display: grid;
  gap: 0.5rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.user-item {
  align-items: center;
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 0.75rem;
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}

.user-name {
  font-weight: 600;
}

.user-role {
  color: #5f6368;
  margin-right: auto;
}

.admin-video-confirm-modal {
  background: #fff;
  border-radius: 1rem;
  display: grid;
  gap: 0.75rem;
  max-width: 24rem;
  padding: 1.25rem;
  width: 100%;
}

.admin-video-confirm-modal p {
  margin: 0;
}

.admin-video-confirm-modal p:first-child {
  font-weight: 600;
}
</style>

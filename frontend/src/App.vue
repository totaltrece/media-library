<template>
  <div v-if="canView">
    <router-view />
  </div>
  <div v-else class="auth-gate-shell">
    <AppHeader title="Media Library" subtitle="Please log in to continue." />
    <div class="auth-gate-card" role="status" aria-live="polite">
      <p class="auth-gate-title">Access restricted</p>
      <p class="auth-gate-text">Sign in with a user with the <strong>view</strong> or <strong>admin</strong> role to access the library.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue";

import AppHeader from "./components/AppHeader.vue";
import { loadAuthSession, useAuth } from "./auth/session.js";

const { canView } = useAuth();

onMounted(() => {
  void loadAuthSession();
});
</script>

<style scoped>
.auth-gate-shell {
  display: grid;
  gap: 1rem;
}

.auth-gate-card {
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 0.75rem;
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
  margin: 0 auto;
  max-width: 28rem;
  padding: 1.5rem;
  text-align: center;
  width: min(100%, 28rem);
}

.auth-gate-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
}

.auth-gate-text {
  color: #5f6368;
  margin: 0;
}
</style>

<template>
  <div v-if="canView">
    <router-view />
  </div>
  <div v-else class="auth-gate-shell">
    <AppHeader title="Media Library" subtitle="Log in with a view or admin account to access the library." />
    <div class="auth-gate-message">
      <p>Access restricted</p>
      <p>Only users with the <strong>view</strong> or <strong>admin</strong> role can continue.</p>
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

.auth-gate-message {
  background: #fff;
  border: 1px solid #dadce0;
  border-radius: 0.75rem;
  color: #3c4043;
  margin: 0 auto;
  max-width: 32rem;
  padding: 1.5rem;
  text-align: center;
  width: min(100%, 32rem);
}

.auth-gate-message p {
  margin: 0;
}

.auth-gate-message p + p {
  margin-top: 0.5rem;
}
</style>

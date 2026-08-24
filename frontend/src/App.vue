<template>
  <router-view />
</template>

<script setup lang="ts">
import { onMounted } from "vue";

import { loadAuthSession } from "./auth/session.js";

onMounted(() => {
  void loadAuthSession();
});
</script>

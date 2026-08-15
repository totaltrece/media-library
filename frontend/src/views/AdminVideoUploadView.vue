<template>
  <div class="app-shell">
    <AppHeader
      title="Upload new video"
      subtitle="Process a video on the server. It will appear under Sin tags when it finishes."
    />

    <AdminVideoUpload @completed="onUploadCompleted" />

    <p v-if="completed" class="admin-upload-next">
      <RouterLink
        class="primary-button"
        data-testid="upload-view-untagged"
        to="/admin/videos?untagged=1"
      >
        View in Sin tags
      </RouterLink>
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import AppHeader from "../components/AppHeader.vue";
import AdminVideoUpload from "../components/AdminVideoUpload.vue";

const completed = ref(false);

function onUploadCompleted(): void {
  completed.value = true;
}
</script>

<style scoped>
.admin-upload-next {
  margin: 1rem 0 0;
}

.admin-upload-next .primary-button {
  display: inline-flex;
  justify-content: center;
  min-height: 2.75rem;
  padding: 0.75rem 1.25rem;
}

@media (max-width: 599px) {
  .admin-upload-next .primary-button {
    width: 100%;
  }
}
</style>

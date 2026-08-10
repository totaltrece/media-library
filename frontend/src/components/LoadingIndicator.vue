<template>
  <div class="loading-indicator" role="status">
    <span>{{ message }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

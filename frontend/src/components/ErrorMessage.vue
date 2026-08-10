<template>
  <div class="status-message error" role="alert">
    {{ message }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
  <button
    class="result-card"
    :class="{ selected: selected }"
    type="button"
    @click="$emit('select')"
  >
    <img :alt="`Thumbnail for video tagged ${result.tags.join(', ')}`" :src="thumbnailUrl" />
    <div class="result-card-tags">
      <span v-for="tag in result.tags" :key="tag" class="result-card-tag">{{ tag }}</span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { buildApiUrl } from "../api/client.js";
import type { SearchResultItem } from "../api/types.js";

const props = defineProps<{
  result: SearchResultItem;
  selected: boolean;
}>();

defineEmits<{
  select: [];
}>();

const thumbnailUrl = computed(() => buildApiUrl(props.result.thumbnail));
</script>

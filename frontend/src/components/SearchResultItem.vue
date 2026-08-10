<template>
  <article class="result-card" :class="{ selected: selected }">
    <button
      class="result-card-thumbnail"
      type="button"
      :aria-label="`Play video tagged ${result.tags.join(', ')}`"
      @click="$emit('select-video')"
    >
      <img :alt="`Thumbnail for video tagged ${result.tags.join(', ')}`" :src="thumbnailUrl" />
    </button>
    <div class="result-card-tags">
      <button
        v-for="tag in result.tags"
        :key="tag"
        class="result-card-tag"
        type="button"
        :aria-label="`Add ${tag} to search`"
        @click="$emit('select-tag', tag)"
      >
        {{ tag }}
      </button>
    </div>
  </article>
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
  "select-video": [];
  "select-tag": [tag: string];
}>();

const thumbnailUrl = computed(() => buildApiUrl(props.result.thumbnail));
</script>

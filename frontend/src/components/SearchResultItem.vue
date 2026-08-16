<template>
  <article class="result-card" :class="{ selected: selected }">
    <button
      class="result-card-thumbnail"
      type="button"
      :aria-label="`Play video tagged ${result.tags.join(', ')}`"
      @click="$emit('select-video')"
    >
      <img :alt="`Thumbnail for video tagged ${result.tags.join(', ')}`" :src="thumbnailUrl" />
      <span v-if="displayDate !== null" class="result-card-date">{{ displayDate }}</span>
    </button>
    <p v-if="showName" class="result-card-name">
      <RouterLink
        v-if="nameLinksToEdit"
        class="result-card-name-link"
        :aria-label="`Edit tags for ${result.name}`"
        :to="{ name: 'admin-video-edit', params: { id: result.id } }"
      >
        {{ result.name }}
      </RouterLink>
      <template v-else>{{ result.name }}</template>
    </p>
    <div class="result-card-tags">
      <template v-if="interactiveTags">
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
      </template>
      <template v-else>
        <span v-for="tag in result.tags" :key="tag" class="result-card-tag">
          {{ tag }}
        </span>
      </template>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import { buildApiUrl } from "../api/client.js";
import type { SearchResultItem } from "../api/types.js";
import { formatVideoDate } from "../utils/video-date.js";

const props = withDefaults(
  defineProps<{
    result: SearchResultItem;
    selected: boolean;
    interactiveTags?: boolean;
    showName?: boolean;
    nameLinksToEdit?: boolean;
  }>(),
  {
    interactiveTags: true,
    showName: false,
    nameLinksToEdit: false,
  },
);

defineEmits<{
  "select-video": [];
  "select-tag": [tag: string];
}>();

const thumbnailUrl = computed(() => buildApiUrl(props.result.thumbnail));
const displayDate = computed(() => formatVideoDate(props.result.recordedAt));
</script>

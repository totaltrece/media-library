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
        Edit video
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
          :style="tagChipStyle(colorForTag(tag, tagColors, defaultColor))"
          @click="$emit('select-tag', tag)"
        >
          {{ tag }}
        </button>
      </template>
      <template v-else>
        <span
          v-for="tag in result.tags"
          :key="tag"
          class="result-card-tag"
          :style="tagChipStyle(colorForTag(tag, tagColors, defaultColor))"
        >
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
import { colorForTag, DEFAULT_TAG_COLOR, tagChipStyle } from "../utils/tag-color.js";
import { formatVideoDate } from "../utils/video-date.js";

const props = withDefaults(
  defineProps<{
    result: SearchResultItem;
    selected: boolean;
    interactiveTags?: boolean;
    showName?: boolean;
    nameLinksToEdit?: boolean;
    tagColors?: Record<string, string>;
    defaultColor?: string;
  }>(),
  {
    interactiveTags: true,
    showName: false,
    nameLinksToEdit: false,
    tagColors: () => ({}),
    defaultColor: DEFAULT_TAG_COLOR,
  },
);

defineEmits<{
  "select-video": [];
  "select-tag": [tag: string];
}>();

const thumbnailUrl = computed(() => buildApiUrl(props.result.thumbnail));
const displayDate = computed(() => formatVideoDate(props.result.recordedAt));
</script>

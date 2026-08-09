<template>
  <section class="video-panel" aria-label="Video player">
    <h2>Now playing</h2>

    <div class="video-player">
      <video
        ref="videoElement"
        controls
        playsinline
        :src="videoUrl"
        @error="onVideoError"
      />
    </div>

    <ErrorMessage v-if="playbackError" :message="playbackError" />

    <div class="result-tags">
      <span v-for="tag in tags" :key="tag" class="tag-chip">{{ tag }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { buildApiUrl } from "../api/client.js";
import ErrorMessage from "./ErrorMessage.vue";

const props = defineProps<{
  videoPath: string;
  tags: string[];
}>();

const videoElement = ref<HTMLVideoElement | null>(null);
const playbackError = ref<string | null>(null);

const videoUrl = computed(() => buildApiUrl(props.videoPath));

watch(
  () => props.videoPath,
  () => {
    playbackError.value = null;

    if (videoElement.value !== null) {
      void videoElement.value.load();
    }
  },
);

function onVideoError(): void {
  playbackError.value = "Unable to play this video.";
}
</script>

<template>
  <div
    class="video-modal-backdrop"
    role="presentation"
    @click.self="$emit('close')"
  >
    <section
      aria-label="Video player"
      aria-modal="true"
      class="video-modal"
      role="dialog"
    >
      <button
        aria-label="Close video"
        class="video-modal-close"
        type="button"
        @click="$emit('close')"
      >
        ×
      </button>

      <div class="video-player">
        <video
          ref="videoElement"
          controls
          playsinline
          :controlslist="canWrite ? undefined : 'nodownload'"
          :src="videoUrl"
          @error="onVideoError"
        />
      </div>

      <ErrorMessage v-if="playbackError" :message="playbackError" />

      <div class="result-tags">
        <span
          v-for="tag in tags"
          :key="tag"
          class="tag-chip"
          :style="tagChipStyle(colorForTag(tag, tagColors, defaultColor))"
        >{{ tag }}</span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";

import { buildApiUrl } from "../api/client.js";
import { useAuth } from "../auth/session.js";
import ErrorMessage from "./ErrorMessage.vue";
import { colorForTag, DEFAULT_TAG_COLOR, tagChipStyle } from "../utils/tag-color.js";

const props = withDefaults(
  defineProps<{
    videoPath: string;
    tags: string[];
    tagColors?: Record<string, string>;
    defaultColor?: string;
  }>(),
  {
    tagColors: () => ({}),
    defaultColor: DEFAULT_TAG_COLOR,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const { canWrite } = useAuth();
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

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    emit("close");
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>

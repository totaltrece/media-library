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
          disableRemotePlayback
          playsinline
          :controlslist="canView ? undefined : 'nodownload'"
          :src="videoUrl"
          @error="onVideoError"
        />
      </div>

      <div class="video-player-actions">
        <button
          class="secondary-button"
          data-testid="cast-video"
          type="button"
          :disabled="castPending"
          @click="onCast"
        >
          {{ castPending ? "Connecting..." : "Cast" }}
        </button>
        <a
          v-if="canView"
          class="secondary-button"
          data-testid="download-video"
          :download="downloadName"
          :href="downloadUrl"
        >Download</a>
      </div>

      <p
        v-if="castMessage"
        class="status-message"
        :class="castFailed ? 'error' : 'info'"
        :role="castFailed ? 'alert' : 'status'"
      >
        {{ castMessage }}
      </p>

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

import { ApiRequestError, buildApiUrl, requestCastLink } from "../api/client.js";
import { useAuth } from "../auth/session.js";
import { castPlaybackMessage, castReachabilityMessage } from "../cast/cast-messages.js";
import { CastUnavailableError, isCastCancelled, startCastPlayback } from "../cast/cast-sender.js";
import ErrorMessage from "./ErrorMessage.vue";
import { colorForTag, DEFAULT_TAG_COLOR, tagChipStyle } from "../utils/tag-color.js";
import { absoluteStreamUrl, downloadFileName, downloadUrlForVideoPath, mediaIdFromVideoPath } from "../utils/video-links.js";

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

const { canView } = useAuth();
const videoElement = ref<HTMLVideoElement | null>(null);
const playbackError = ref<string | null>(null);
const castPending = ref(false);
const castMessage = ref<string | null>(null);
const castFailed = ref(false);

const videoUrl = computed(() => buildApiUrl(props.videoPath));
const downloadUrl = computed(() => downloadUrlForVideoPath(props.videoPath));
const downloadName = computed(() => downloadFileName(props.videoPath));

watch(
  () => props.videoPath,
  () => {
    playbackError.value = null;
    castMessage.value = null;
    castFailed.value = false;

    if (videoElement.value !== null) {
      void videoElement.value.load();
    }
  },
);

async function onCast(): Promise<void> {
  castMessage.value = null;
  castFailed.value = false;

  const blocked = castReachabilityMessage(window.location.hostname);

  if (blocked !== null) {
    castMessage.value = blocked;
    castFailed.value = true;
    return;
  }

  const mediaId = mediaIdFromVideoPath(props.videoPath);

  if (mediaId === null) {
    castMessage.value = "This video cannot be cast.";
    castFailed.value = true;
    return;
  }

  castPending.value = true;

  try {
    const link = await requestCastLink(mediaId);
    await startCastPlayback({
      contentUrl: absoluteStreamUrl(link.streamPath, window.location.origin),
      contentType: link.contentType,
      title: link.title,
      currentTime: videoElement.value?.currentTime ?? 0,
    });
    videoElement.value?.pause();
    castMessage.value = castPlaybackMessage({
      receiverCompatible: link.receiverCompatible,
      protocol: window.location.protocol,
    });
  } catch (error: unknown) {
    if (isCastCancelled(error)) {
      return;
    }

    castFailed.value = true;
    castMessage.value =
      error instanceof CastUnavailableError || error instanceof ApiRequestError
        ? error.message
        : "Unable to start casting. The Chromecast must be able to reach this site.";
  } finally {
    castPending.value = false;
  }
}

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

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
        <button
          class="cast-button"
          data-testid="cast-video"
          type="button"
          :aria-busy="castPending"
          :aria-label="castPending ? 'Connecting to Chromecast' : 'Cast to Chromecast'"
          :disabled="castPending"
          :title="castPending ? 'Connecting...' : 'Cast'"
          @click="onCast"
        >
          <svg aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
          </svg>
        </button>
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

import { buildApiUrl, requestCastLink } from "../api/client.js";
import type { CastLink } from "../api/types.js";
import { useAuth } from "../auth/session.js";
import {
  castPlaybackMessage,
  castReachabilityMessage,
  castSenderStartingMessage,
  castSenderUnavailableMessage,
  describeCastError,
} from "../cast/cast-messages.js";
import {
  CastUnavailableError,
  isCastCancelled,
  isCastSenderReady,
  openCastSession,
  playOnCastSession,
  preloadCastSender,
} from "../cast/cast-sender.js";
import ErrorMessage from "./ErrorMessage.vue";
import { colorForTag, DEFAULT_TAG_COLOR, tagChipStyle } from "../utils/tag-color.js";
import { absoluteStreamUrl, mediaIdFromVideoPath } from "../utils/video-links.js";

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
const preparedLink = ref<CastLink | null>(null);

const videoUrl = computed(() => buildApiUrl(props.videoPath));

watch(
  () => props.videoPath,
  () => {
    playbackError.value = null;
    castMessage.value = null;
    castFailed.value = false;
    preparedLink.value = null;
    void prepareCastLink();

    if (videoElement.value !== null) {
      void videoElement.value.load();
    }
  },
  { immediate: true },
);

async function prepareCastLink(): Promise<void> {
  const mediaId = mediaIdFromVideoPath(props.videoPath);

  if (mediaId === null || castReachabilityMessage(window.location.hostname) !== null) {
    return;
  }

  try {
    const link = await requestCastLink(mediaId);

    if (mediaIdFromVideoPath(props.videoPath) === mediaId) {
      preparedLink.value = link;
    }
  } catch {
    // The click handler requests a fresh link if this prefetch fails.
  }
}

async function loadCastLink(): Promise<CastLink> {
  if (preparedLink.value !== null) {
    return preparedLink.value;
  }

  const mediaId = mediaIdFromVideoPath(props.videoPath);

  if (mediaId === null) {
    throw new CastUnavailableError("This video cannot be cast.");
  }

  const link = await requestCastLink(mediaId);
  preparedLink.value = link;
  return link;
}

async function onCast(): Promise<void> {
  castMessage.value = null;
  castFailed.value = false;

  const blocked = castReachabilityMessage(window.location.hostname);

  if (blocked !== null) {
    castMessage.value = blocked;
    castFailed.value = true;
    return;
  }

  if (mediaIdFromVideoPath(props.videoPath) === null) {
    castMessage.value = "This video cannot be cast.";
    castFailed.value = true;
    return;
  }

  if (!isCastSenderReady()) {
    castPending.value = true;

    try {
      const ready = await preloadCastSender();
      const available = ready && isCastSenderReady();
      castFailed.value = !available;
      castMessage.value = available
        ? castSenderStartingMessage()
        : castSenderUnavailableMessage(window.location.protocol);
    } finally {
      castPending.value = false;
    }

    return;
  }

  const currentTime = videoElement.value?.currentTime ?? 0;
  castPending.value = true;

  try {
    const sessionPromise = openCastSession();
    const link = await loadCastLink();
    const session = await sessionPromise;
    await playOnCastSession(session, {
      ...castRequest(link),
      currentTime,
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
    castMessage.value = describeCastError(error, window.location.protocol);
  } finally {
    castPending.value = false;
  }
}

function castRequest(link: CastLink): {
  contentUrl: string;
  contentType: string;
  title: string;
  currentTime: number;
  receiverCompatible: boolean;
} {
  return {
    contentUrl: absoluteStreamUrl(link.streamPath, window.location.origin),
    contentType: link.contentType,
    title: link.title,
    currentTime: videoElement.value?.currentTime ?? 0,
    receiverCompatible: link.receiverCompatible,
  };
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
  if (castReachabilityMessage(window.location.hostname) === null) {
    void preloadCastSender();
  }

  window.addEventListener("keydown", onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKeyDown);
});
</script>

const CAST_SENDER_SRC = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const FALLBACK_RECEIVER_APP_ID = "CC1AD845";
const SENDER_TIMEOUT_MS = 8000;
const UNAVAILABLE_GRACE_MS = 2500;

export class CastUnavailableError extends Error {
  constructor(message = "This browser did not open media casting. Casting the whole tab does not send the video file.") {
    super(message);
    this.name = "CastUnavailableError";
  }
}

export interface CastMediaRequest {
  contentUrl: string;
  contentType: string;
  title: string;
  currentTime: number;
}

interface CastSession {
  loadMedia(request: Record<string, unknown>): Promise<unknown>;
}

interface CastContext {
  setOptions(options: { receiverApplicationId: string; autoJoinPolicy: string }): void;
  requestSession(): Promise<unknown>;
  getCurrentSession(): unknown;
}

interface CastConstructors {
  context: CastContext;
  mediaInfo: unknown;
  genericMediaMetadata: unknown;
  loadRequest: unknown;
  bufferedStreamType: string;
  genericMetadataType: number | undefined;
  receiverApplicationId: string;
  autoJoinPolicy: string;
}

let senderPromise: Promise<boolean> | null = null;
let castApi: CastConstructors | null = null;

export function isCastCancelled(error: unknown): boolean {
  if (typeof error === "string") {
    return error.toLowerCase() === "cancel";
  }

  if (!isRecord(error)) {
    return false;
  }

  const code = "code" in error ? String(error.code).toLowerCase() : "";
  const message = "message" in error && typeof error.message === "string" ? error.message.toLowerCase() : "";

  return code === "cancel" || message === "cancel";
}

export function resolveCastSession(requestResult: unknown, currentSession: unknown): CastSession | null {
  if (isCastSession(requestResult)) {
    return requestResult;
  }

  if (isCastSession(currentSession)) {
    return currentSession;
  }

  return null;
}

export async function startCastPlayback(request: CastMediaRequest): Promise<void> {
  const ready = await ensureCastSender();

  if (!ready || castApi === null) {
    throw new CastUnavailableError();
  }

  const session = await requestCastSession(castApi.context);
  const loadRequest = buildLoadRequest(castApi, request);

  if (loadRequest === null) {
    throw new CastUnavailableError();
  }

  await session.loadMedia(loadRequest);
}

export function hasRemotePlayback(video: HTMLVideoElement): boolean {
  return readRemotePlayback(video) !== null;
}

export async function startRemotePlayback(video: HTMLVideoElement, request: CastMediaRequest): Promise<void> {
  const remote = readRemotePlayback(video);

  if (remote === null) {
    throw new CastUnavailableError();
  }

  video.disableRemotePlayback = false;

  if (video.src !== request.contentUrl) {
    video.src = request.contentUrl;
  }

  if (request.currentTime > 0) {
    const applyTime = (): void => {
      try {
        video.currentTime = request.currentTime;
      } catch {
        // Metadata may still be loading. Playback can start at the beginning.
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applyTime();
    } else {
      video.addEventListener("loadedmetadata", applyTime, { once: true });
    }
  }

  await remote.prompt();

  try {
    await video.play();
  } catch (error: unknown) {
    const state = remote.state();

    if (state === "connected" || state === "connecting") {
      return;
    }

    throw error;
  }
}

function ensureCastSender(): Promise<boolean> {
  if (castApi !== null) {
    return Promise.resolve(true);
  }

  if (senderPromise === null) {
    senderPromise = loadSender().then((ready) => {
      if (!ready) {
        senderPromise = null;
      }

      return ready;
    });
  }

  return senderPromise;
}

function loadSender(): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let unavailableTimer: number | undefined;

    const finish = (ready: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);

      if (unavailableTimer !== undefined) {
        window.clearTimeout(unavailableTimer);
      }

      resolve(ready);
    };

    const succeed = (): void => {
      if (initializeCast()) {
        finish(true);
      }
    };

    const timeout = window.setTimeout(() => finish(false), SENDER_TIMEOUT_MS);
    const win = window as Window & { __onGCastApiAvailable?: (available: boolean) => void };

    win.__onGCastApiAvailable = (available: boolean) => {
      if (available) {
        succeed();
        return;
      }

      // Chrome often reports unavailable once while the Cast component starts, then calls again.
      if (unavailableTimer === undefined) {
        unavailableTimer = window.setTimeout(() => finish(castApi !== null), UNAVAILABLE_GRACE_MS);
      }
    };

    if (initializeCast()) {
      finish(true);
      return;
    }

    const script = document.createElement("script");
    script.src = CAST_SENDER_SRC;
    script.async = true;
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
}

function initializeCast(): boolean {
  const api = readCastConstructors();

  if (api === null) {
    return false;
  }

  try {
    api.context.setOptions({
      receiverApplicationId: api.receiverApplicationId,
      autoJoinPolicy: api.autoJoinPolicy,
    });
  } catch {
    // Options may already be set from a previous attempt.
  }

  castApi = api;
  return true;
}

async function requestCastSession(context: CastContext): Promise<CastSession> {
  const existing = resolveCastSession(undefined, context.getCurrentSession());

  if (existing !== null) {
    return existing;
  }

  const result = await context.requestSession();
  const session = resolveCastSession(result, context.getCurrentSession());

  if (session === null) {
    throw new CastUnavailableError();
  }

  return session;
}

function buildLoadRequest(api: CastConstructors, request: CastMediaRequest): Record<string, unknown> | null {
  const mediaInfo = createInstance(api.mediaInfo, [request.contentUrl, request.contentType]);
  const metadata = createInstance(api.genericMediaMetadata, []);

  if (!isRecord(mediaInfo) || !isRecord(metadata)) {
    return null;
  }

  mediaInfo.contentId = request.contentUrl;
  mediaInfo.contentUrl = request.contentUrl;
  mediaInfo.contentType = request.contentType;
  mediaInfo.streamType = api.bufferedStreamType;
  metadata.metadataType = api.genericMetadataType ?? 0;
  metadata.title = request.title;
  mediaInfo.metadata = metadata;

  const loadRequest = createInstance(api.loadRequest, [mediaInfo]);

  if (!isRecord(loadRequest)) {
    return null;
  }

  loadRequest.autoplay = true;
  loadRequest.currentTime = request.currentTime;
  return loadRequest;
}

function readCastConstructors(): CastConstructors | null {
  const castRoot = (globalThis as { cast?: unknown }).cast;
  const chromeRoot = (globalThis as { chrome?: unknown }).chrome;

  if (!isRecord(castRoot) || !isRecord(castRoot.framework) || !isRecord(chromeRoot) || !isRecord(chromeRoot.cast)) {
    return null;
  }

  const framework = castRoot.framework;
  const chromeCast = chromeRoot.cast;

  if (!isRecord(framework.CastContext) || !isRecord(chromeCast.media)) {
    return null;
  }

  const context = callMethod(framework.CastContext, "getInstance");

  if (!isCastContext(context)) {
    return null;
  }

  const media = chromeCast.media;

  if (
    typeof media.MediaInfo !== "function" ||
    typeof media.GenericMediaMetadata !== "function" ||
    typeof media.LoadRequest !== "function"
  ) {
    return null;
  }

  return {
    context,
    mediaInfo: media.MediaInfo,
    genericMediaMetadata: media.GenericMediaMetadata,
    loadRequest: media.LoadRequest,
    bufferedStreamType: readString(media.StreamType, "BUFFERED") ?? "BUFFERED",
    genericMetadataType: readNumber(media.MetadataType, "GENERIC"),
    receiverApplicationId: readString(media, "DEFAULT_MEDIA_RECEIVER_APP_ID") ?? FALLBACK_RECEIVER_APP_ID,
    autoJoinPolicy: readString(chromeCast.AutoJoinPolicy, "ORIGIN_SCOPED") ?? "origin_scoped",
  };
}

function readRemotePlayback(video: HTMLVideoElement): { prompt: () => Promise<void>; state: () => string } | null {
  const candidate: unknown = Reflect.get(video, "remote");

  if (!isRecord(candidate) || typeof candidate.prompt !== "function") {
    return null;
  }

  const prompt = candidate.prompt;

  return {
    prompt: () => Promise.resolve(prompt.call(candidate)),
    state: () => (typeof candidate.state === "string" ? candidate.state : ""),
  };
}

function callMethod(target: Record<string, unknown>, key: string): unknown {
  const method = target[key];

  if (typeof method !== "function") {
    return undefined;
  }

  return method.call(target);
}

function readString(source: unknown, key: string): string | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  const value = source[key];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(source: unknown, key: string): number | undefined {
  if (!isRecord(source)) {
    return undefined;
  }

  const value = source[key];

  return typeof value === "number" ? value : undefined;
}

function createInstance(constructor: unknown, args: unknown[]): unknown {
  if (typeof constructor !== "function") {
    return undefined;
  }

  const Construct = constructor as new (...params: unknown[]) => unknown;

  return new Construct(...args);
}

function isCastContext(value: unknown): value is CastContext {
  return (
    isRecord(value) &&
    typeof value.setOptions === "function" &&
    typeof value.requestSession === "function" &&
    typeof value.getCurrentSession === "function"
  );
}

function isCastSession(value: unknown): value is CastSession {
  return isRecord(value) && typeof value.loadMedia === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

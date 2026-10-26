const CAST_SENDER_SRC = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const FALLBACK_RECEIVER_APP_ID = "CC1AD845";
const SENDER_TIMEOUT_MS = 8000;
const PLAYBACK_TIMEOUT_MS = 20000;

export class CastUnavailableError extends Error {
  constructor(message = "This browser did not open media casting. Casting the whole tab does not send the video file.") {
    super(message);
    this.name = "CastUnavailableError";
  }
}

export class CastPlaybackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CastPlaybackError";
  }
}

export interface CastMediaRequest {
  contentUrl: string;
  contentType: string;
  title: string;
  currentTime: number;
  receiverCompatible: boolean;
}

export type CastPlayerStatus = "playing" | "buffering" | "failed" | "pending";

interface CastSession {
  loadMedia(request: Record<string, unknown>): Promise<unknown>;
  getMediaSession?(): unknown;
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

export function preloadCastSender(): Promise<boolean> {
  return ensureCastSender();
}

export function isCastSenderReady(): boolean {
  return castApi !== null;
}

export function readCastPlayerStatus(media: unknown): CastPlayerStatus {
  if (!isRecord(media)) {
    return "pending";
  }

  const state = typeof media.playerState === "string" ? media.playerState : "";

  if (state === "PLAYING" || state === "PAUSED") {
    return "playing";
  }

  if (state === "BUFFERING") {
    return "buffering";
  }

  if (state === "IDLE") {
    const reason = typeof media.idleReason === "string" ? media.idleReason : "";

    if (reason === "ERROR" || reason === "CANCELLED" || reason === "INTERRUPTED") {
      return "failed";
    }
  }

  return "pending";
}

/**
 * Opens the device picker. Call this directly from the click handler, before any await,
 * so Chrome still treats it as a user gesture.
 */
export function openCastSession(): Promise<CastSession> {
  if (castApi === null) {
    throw new CastUnavailableError();
  }

  const existing = resolveCastSession(undefined, castApi.context.getCurrentSession());

  if (existing !== null) {
    return Promise.resolve(existing);
  }

  const pending = castApi.context.requestSession();

  return pending.then((result) => {
    const session = resolveCastSession(result, castApi?.context.getCurrentSession());

    if (session === null) {
      throw new CastUnavailableError();
    }

    return session;
  });
}

export async function playOnCastSession(session: CastSession, request: CastMediaRequest): Promise<void> {
  if (castApi === null) {
    throw new CastUnavailableError();
  }

  const loadRequest = buildLoadRequest(castApi, request);

  if (loadRequest === null) {
    throw new CastUnavailableError();
  }

  const loaded = await session.loadMedia(loadRequest);
  const media = asMedia(loaded) ?? readSessionMedia(session);

  if (media === null) {
    throw new CastPlaybackError(receiverFailureMessage(request));
  }

  await waitUntilPlaying(media, request);
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

    const finish = (ready: boolean): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      resolve(ready);
    };

    const succeed = (): void => {
      if (initializeCast()) {
        finish(true);
      }
    };

    const timeout = window.setTimeout(() => finish(castApi !== null), SENDER_TIMEOUT_MS);
    const win = window as Window & { __onGCastApiAvailable?: (available: boolean) => void };

    win.__onGCastApiAvailable = (available: boolean) => {
      // Chrome often reports unavailable once while the Cast component starts, then calls again.
      if (available) {
        succeed();
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

  if (request.currentTime > 0) {
    loadRequest.currentTime = request.currentTime;
  }

  return loadRequest;
}

function asMedia(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.playerState === "string" || typeof value.addUpdateListener === "function") {
    return value;
  }

  return null;
}

function readSessionMedia(session: CastSession): Record<string, unknown> | null {
  if (typeof session.getMediaSession !== "function") {
    return null;
  }

  return asMedia(session.getMediaSession());
}

function waitUntilPlaying(media: Record<string, unknown>, request: CastMediaRequest): Promise<void> {
  const initial = readCastPlayerStatus(media);

  if (initial === "playing") {
    return Promise.resolve();
  }

  if (initial === "failed") {
    return Promise.reject(new CastPlaybackError(receiverFailureMessage(request)));
  }

  return new Promise((resolve, reject) => {
    let buffering = initial === "buffering";
    let settled = false;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timer);
      removeListener();

      if (error !== undefined) {
        reject(error);
        return;
      }

      resolve();
    };

    const onUpdate = (isAlive?: boolean): void => {
      if (isAlive === false) {
        finish(new CastPlaybackError(receiverFailureMessage(request)));
        return;
      }

      const status = readCastPlayerStatus(media);

      if (status === "playing") {
        finish();
        return;
      }

      if (status === "failed") {
        finish(new CastPlaybackError(receiverFailureMessage(request)));
        return;
      }

      if (status === "buffering") {
        buffering = true;
      }
    };

    let removeListener = (): void => undefined;
    const timer = window.setTimeout(() => {
      finish(buffering ? undefined : new CastPlaybackError(receiverFailureMessage(request)));
    }, PLAYBACK_TIMEOUT_MS);
    removeListener = addMediaListener(media, onUpdate);

    onUpdate();
  });
}

function addMediaListener(
  media: Record<string, unknown>,
  listener: (isAlive?: boolean) => void,
): () => void {
  const add = media.addUpdateListener;

  if (typeof add !== "function") {
    return () => undefined;
  }

  add.call(media, listener);

  const remove = media.removeUpdateListener;

  if (typeof remove !== "function") {
    return () => undefined;
  }

  return () => {
    remove.call(media, listener);
  };
}

function receiverFailureMessage(request: CastMediaRequest): string {
  const host = mediaHost(request.contentUrl);
  const format = request.receiverCompatible
    ? "The TV has to reach that host over HTTPS with a certificate it trusts."
    : "This format often stays blank on a Chromecast. MP4 (H.264/AAC) and WebM work.";

  return `The Chromecast could not play this video. It has to download it from ${host}. ${format}`;
}

function mediaHost(contentUrl: string): string {
  try {
    return new URL(contentUrl).host;
  } catch {
    return contentUrl;
  }
}

export function readCastConstructors(
  castRoot: unknown = (globalThis as { cast?: unknown }).cast,
  chromeRoot: unknown = (globalThis as { chrome?: unknown }).chrome,
): CastConstructors | null {
  if (!isRecord(castRoot) || !isRecord(castRoot.framework) || !isRecord(chromeRoot) || !isRecord(chromeRoot.cast)) {
    return null;
  }

  const framework = castRoot.framework;
  const chromeCast = chromeRoot.cast;
  const CastContext = framework.CastContext;

  // CastContext is a constructor function with a static getInstance(), not a plain object.
  if ((typeof CastContext !== "function" && !isRecord(CastContext)) || !isRecord(chromeCast.media)) {
    return null;
  }

  const context = callMethod(CastContext, "getInstance");

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

function callMethod(target: object, key: string): unknown {
  const method: unknown = Reflect.get(target, key);

  if (typeof method !== "function") {
    return undefined;
  }

  return Reflect.apply(method, target, []);
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

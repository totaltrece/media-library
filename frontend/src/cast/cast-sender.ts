const CAST_SENDER_SRC = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
const FALLBACK_RECEIVER_APP_ID = "CC1AD845";

export class CastUnavailableError extends Error {
  constructor() {
    super("Casting is available in Chrome or Edge when a Chromecast is on the same network.");
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

  if (!isRecord(error) || !("code" in error)) {
    return false;
  }

  return String(error.code).toLowerCase() === "cancel";
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
      resolve(ready && initializeCast());
    };
    const timeout = window.setTimeout(() => finish(false), 8000);
    const win = window as Window & { __onGCastApiAvailable?: (available: boolean) => void };

    win.__onGCastApiAvailable = (available: boolean) => {
      finish(available);
    };

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
    castApi = api;
    return true;
  } catch {
    return false;
  }
}

async function requestCastSession(context: CastContext): Promise<CastSession> {
  const current = context.getCurrentSession();

  if (isCastSession(current)) {
    return current;
  }

  const session = await context.requestSession();

  if (!isCastSession(session)) {
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

  mediaInfo.streamType = api.bufferedStreamType;

  if (api.genericMetadataType !== undefined) {
    metadata.metadataType = api.genericMetadataType;
  }

  metadata.title = request.title;
  mediaInfo.metadata = metadata;

  const loadRequest = createInstance(api.loadRequest, [mediaInfo]);

  if (!isRecord(loadRequest)) {
    return null;
  }

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

  if (!isRecord(framework.CastContext) || typeof framework.CastContext.getInstance !== "function" || !isRecord(chromeCast.media)) {
    return null;
  }

  const context: unknown = framework.CastContext.getInstance.call(framework.CastContext);

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

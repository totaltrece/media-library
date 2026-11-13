import { describe, expect, it } from "vitest";

import {
  castPlaybackMessage,
  castReachabilityMessage,
  castSenderUnavailableMessage,
  describeCastError,
} from "../src/cast/cast-messages.js";
import { isCastCancelled, readCastConstructors, readCastPlayerStatus, resolveCastSession } from "../src/cast/cast-sender.js";
import {
  absoluteStreamUrl,
  downloadFileName,
  downloadUrlForVideoPath,
  mediaIdFromVideoPath,
} from "../src/utils/video-links.js";

describe("video links", () => {
  it("reads a media id and builds a same-origin download url", () => {
    expect(mediaIdFromVideoPath("/api/video/salsa/my%20clip.mp4")).toBe("salsa/my clip.mp4");
    expect(downloadFileName("/api/video/salsa/my%20clip.mp4")).toBe("my clip.mp4");
    expect(downloadUrlForVideoPath("/api/video/salsa/my clip.mp4")).toBe("/api/video/salsa/my%20clip.mp4?download=1");
    expect(absoluteStreamUrl("/api/video/salsa/clip.mp4?cast=1.abc", "http://192.168.1.20:3000")).toBe(
      "http://192.168.1.20:3000/api/video/salsa/clip.mp4?cast=1.abc",
    );
  });
});

describe("cast messages", () => {
  it("blocks localhost and explains HTTP playback", () => {
    expect(castReachabilityMessage("localhost")).toContain("localhost");
    expect(castReachabilityMessage("[::1]")).toContain("localhost");
    expect(castReachabilityMessage("192.168.1.20")).toBeNull();
    expect(castPlaybackMessage({ receiverCompatible: true, protocol: "https:" })).toContain("Playing on Chromecast");
    expect(castPlaybackMessage({ receiverCompatible: true, protocol: "https:" })).toContain("AAC");
    expect(castPlaybackMessage({ receiverCompatible: false, protocol: "http:" })).toContain("MP4");
    expect(castPlaybackMessage({ receiverCompatible: true, protocol: "http:" })).toContain("HTTPS");
  });

  it("treats a cancelled device picker as a cancel", () => {
    expect(isCastCancelled("cancel")).toBe(true);
    expect(isCastCancelled({ code: "cancel" })).toBe(true);
    expect(isCastCancelled({ code: "timeout" })).toBe(false);
  });

  it("treats a black receiver as not playing yet", () => {
    expect(readCastPlayerStatus({ playerState: "PLAYING" })).toBe("playing");
    expect(readCastPlayerStatus({ playerState: "BUFFERING" })).toBe("buffering");
    expect(readCastPlayerStatus({ playerState: "IDLE", idleReason: "NONE" })).toBe("pending");
    expect(readCastPlayerStatus({ playerState: "IDLE", idleReason: "ERROR" })).toBe("failed");
  });

  it("includes the cast sender error code", () => {
    expect(describeCastError({ code: "load_failed", description: "Load failed" }, "https:")).toContain("load_failed");
  });

  it("explains that casting the browser tab does not send the video", () => {
    expect(castSenderUnavailableMessage("https:")).toContain("whole tab");
    expect(castSenderUnavailableMessage("http:")).toContain("http://");
  });

  it("reads CastContext when it is a constructor function", () => {
    function CastContext(this: unknown): void {
      return;
    }

    CastContext.getInstance = () => ({
      setOptions: () => undefined,
      requestSession: () => Promise.resolve(undefined),
      getCurrentSession: () => null,
    });

    function MediaInfo(this: unknown): void {
      return;
    }

    function GenericMediaMetadata(this: unknown): void {
      return;
    }

    function LoadRequest(this: unknown): void {
      return;
    }

    const api = readCastConstructors(
      { framework: { CastContext } },
      {
        cast: {
          media: {
            MediaInfo,
            GenericMediaMetadata,
            LoadRequest,
            StreamType: { BUFFERED: "BUFFERED" },
            MetadataType: { GENERIC: 0 },
            DEFAULT_MEDIA_RECEIVER_APP_ID: "CC1AD845",
          },
          AutoJoinPolicy: { ORIGIN_SCOPED: "origin_scoped" },
        },
      },
    );

    expect(api?.receiverApplicationId).toBe("CC1AD845");
  });

  it("reads the cast session after requestSession resolves empty", () => {
    const session = { loadMedia: () => Promise.resolve(undefined) };

    expect(resolveCastSession(null, session)).toBe(session);
    expect(resolveCastSession(undefined, null)).toBeNull();
  });
});

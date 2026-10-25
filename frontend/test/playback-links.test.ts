import { describe, expect, it } from "vitest";

import { castPlaybackMessage, castReachabilityMessage } from "../src/cast/cast-messages.js";
import { isCastCancelled } from "../src/cast/cast-sender.js";
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
    expect(castPlaybackMessage({ receiverCompatible: true, protocol: "https:" })).toBe("Playing on Chromecast.");
    expect(castPlaybackMessage({ receiverCompatible: false, protocol: "http:" })).toContain("MP4");
    expect(castPlaybackMessage({ receiverCompatible: true, protocol: "http:" })).toContain("HTTPS");
  });

  it("treats a cancelled device picker as a cancel", () => {
    expect(isCastCancelled("cancel")).toBe(true);
    expect(isCastCancelled({ code: "cancel" })).toBe(true);
    expect(isCastCancelled({ code: "timeout" })).toBe(false);
  });
});

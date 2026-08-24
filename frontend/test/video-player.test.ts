import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import { ANONYMOUS_AUTH, setAuthSessionForTests } from "../src/auth/session.js";
import VideoPlayer from "../src/components/VideoPlayer.vue";

describe("VideoPlayer download control", () => {
  it("allows the native download control for an admin session", () => {
    const wrapper = mount(VideoPlayer, {
      props: {
        videoPath: "/api/video/salsa/first.mp4",
        tags: ["salsa"],
      },
    });

    expect(wrapper.get("video").attributes("controlslist")).toBeUndefined();
  });

  it("hides the native download control when the session is not admin", () => {
    setAuthSessionForTests(ANONYMOUS_AUTH);

    const wrapper = mount(VideoPlayer, {
      props: {
        videoPath: "/api/video/salsa/first.mp4",
        tags: ["salsa"],
      },
    });

    expect(wrapper.get("video").attributes("controlslist")).toBe("nodownload");
  });
});

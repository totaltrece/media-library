import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ANONYMOUS_AUTH, setAuthSessionForTests, VIEW_AUTH } from "../src/auth/session.js";
import VideoPlayer from "../src/components/VideoPlayer.vue";

describe("VideoPlayer download control", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows download for an admin session", () => {
    const wrapper = mount(VideoPlayer, {
      props: {
        videoPath: "/api/video/salsa/first.mp4",
        tags: ["salsa"],
      },
    });

    expect(wrapper.get("video").attributes("controlslist")).toBeUndefined();
    expect(wrapper.find("[data-testid=download-video]").exists()).toBe(false);
  });

  it("allows download for a view session", () => {
    setAuthSessionForTests(VIEW_AUTH);

    const wrapper = mount(VideoPlayer, {
      props: {
        videoPath: "/api/video/salsa/my clip.mp4",
        tags: ["salsa"],
      },
    });

    expect(wrapper.get("video").attributes("controlslist")).toBeUndefined();
    expect(wrapper.find("[data-testid=download-video]").exists()).toBe(false);
    expect(wrapper.get("[data-testid=cast-video]").attributes("aria-label")).toBe("Cast to Chromecast");
    expect(wrapper.get(".video-player").find("[data-testid=cast-video]").exists()).toBe(true);
  });

  it("hides download when the session is anonymous", () => {
    setAuthSessionForTests(ANONYMOUS_AUTH);

    const wrapper = mount(VideoPlayer, {
      props: {
        videoPath: "/api/video/salsa/first.mp4",
        tags: ["salsa"],
      },
    });

    expect(wrapper.get("video").attributes("controlslist")).toBe("nodownload");
    expect(wrapper.find("[data-testid=download-video]").exists()).toBe(false);
  });

  it("explains that Chromecast cannot reach localhost", async () => {
    setAuthSessionForTests(VIEW_AUTH);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(VideoPlayer, {
      props: {
        videoPath: "/api/video/salsa/first.mp4",
        tags: ["salsa"],
      },
    });

    await wrapper.get("[data-testid=cast-video]").trigger("click");

    expect(wrapper.text()).toContain("localhost");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

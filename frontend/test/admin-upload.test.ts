import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import type { SearchResultItem, UploadJobView } from "../src/api/types.js";
import AdminVideoUpload from "../src/components/AdminVideoUpload.vue";
import TagSearch from "../src/components/TagSearch.vue";
import { routes } from "../src/router.js";
import { UPLOAD_POLL_INTERVAL_MS } from "../src/utils/upload-job.js";
import AdminVideosView from "../src/views/AdminVideosView.vue";
import { tagItems } from "./tag-fixtures.js";

const catalogVideos: SearchResultItem[] = [
  {
    id: "untagged.mp4",
    name: "20260801_new.mp4",
    thumbnail: "/api/thumbnail/untagged.mp4",
    video: "/api/video/untagged.mp4",
    tags: [],
    recordedAt: null,
  },
  {
    id: "salsa/first.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa/first.mp4",
    video: "/api/video/salsa/first.mp4",
    tags: ["salsa"],
    recordedAt: null,
  },
];

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function jobView(partial: Partial<UploadJobView>): UploadJobView {
  return {
    jobId: "job-1",
    status: "uploading",
    phase: "uploading",
    videoId: "clip.mp4",
    converted: null,
    progress: null,
    outputs: null,
    ...partial,
  };
}

function noActiveUpload(): Response {
  return jsonResponse({ error: { message: "No active upload job." } }, false, 404);
}

function selectFile(wrapper: ReturnType<typeof mount>, name = "clip.mp4"): File {
  const file = new File(["video-bytes"], name, { type: "video/mp4" });
  const input = wrapper.get('[data-testid="upload-file-input"]');
  Object.defineProperty(input.element, "files", {
    configurable: true,
    value: [file],
  });
  return file;
}

async function chooseFile(wrapper: ReturnType<typeof mount>, name = "clip.mp4"): Promise<File> {
  const file = selectFile(wrapper, name);
  await wrapper.get('[data-testid="upload-file-input"]').trigger("change");
  await nextTick();
  return file;
}

function createUploadRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes,
  });
}

describe("admin video upload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval"],
    });
    vi.stubGlobal("fetch", vi.fn(async () => noActiveUpload()));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the upload zone and selected file name", async () => {
    const wrapper = mount(AdminVideoUpload);
    expect(wrapper.text()).toContain("Upload video");
    expect(wrapper.get('[data-testid="upload-select"]').text()).toContain("Select video");

    await chooseFile(wrapper, "PXL_clip.mp4");
    expect(wrapper.get('[data-testid="upload-file-name"]').text()).toBe("PXL_clip.mp4");
  });

  it("asks for a file before uploading", async () => {
    const fetchMock = vi.fn(async () => noActiveUpload());
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(AdminVideoUpload);
    await flushPromises();

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/uploads", expect.anything());
    expect(wrapper.text()).toContain("Select a video first.");
  });

  it("posts multipart without a manual content-type and polls job status", async () => {
    const states: UploadJobView[] = [
      jobView({ status: "uploading", phase: "uploading" }),
      jobView({ status: "processing", phase: "processing", converted: true, progress: 47 }),
      jobView({ status: "processing", phase: "generating_thumbnail", converted: true, progress: 100 }),
      jobView({ status: "processing", phase: "installing", converted: true, progress: 100 }),
      jobView({ status: "completed", phase: "completed", converted: true, progress: 100 }),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (url === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      if (url === "/api/admin/uploads/job-1") {
        return jsonResponse(states.shift() ?? jobView({ status: "completed", phase: "completed" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    const file = await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/uploads", {
      method: "POST",
      body: expect.any(FormData),
    });
    const postCall = fetchMock.mock.calls.find(([url, init]) => String(url) === "/api/admin/uploads" && init?.method === "POST");
    expect(postCall?.[1]?.headers).toBeUndefined();
    expect((postCall?.[1]?.body as FormData).get("video")).toBe(file);
    expect(wrapper.emitted("completed")).toBeUndefined();
    expect(wrapper.text()).toContain("Video in progress");
    expect(wrapper.find('[data-testid="upload-select"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="upload-submit"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="upload-file-name"]').text()).toBe("clip.mp4");
    expect(wrapper.get('[data-step="uploading"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
    expect(wrapper.get('[data-step="processing"]').text()).toContain("Processing video · 47%");
    expect(wrapper.find('[data-testid="upload-progress-bar"]').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="generating_thumbnail"]').classes()).toContain("is-current");
    expect(wrapper.get('[data-step="generating_thumbnail"]').text()).toContain("Generating thumbnail");
    expect(wrapper.get('[data-step="processing"]').text()).not.toContain("%");
    expect(wrapper.find('[data-testid="upload-progress-bar"]').exists()).toBe(false);

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="installing"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-testid="upload-success"]').text()).toBe("Video added successfully");
    expect(wrapper.emitted("completed")).toHaveLength(1);

    const getCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 3);
    await flushPromises();
    const getCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(getCallsAfter).toBe(getCallsBefore);
  });

  it("stops polling and shows a safe message when the job fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (url === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      return jsonResponse(
        jobView({
          status: "failed",
          phase: "failed",
          error: { message: "Video processing failed at C:\\secret" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("The video could not be processed.");
    expect(wrapper.text()).not.toContain("C:\\secret");

    const getCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 2);
    await flushPromises();
    const getCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(getCallsAfter).toBe(getCallsBefore);
  });

  it("clears the polling timer on unmount", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (String(input) === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      return jsonResponse(jobView({ status: "processing", phase: "processing" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();
    wrapper.unmount();

    const getCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 3);
    await flushPromises();
    const getCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(getCallsAfter).toBe(getCallsBefore);
  });

  it("keeps polling after a temporary status request failure", async () => {
    let polls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (String(input) === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      polls += 1;
      if (polls === 1) {
        throw new TypeError("Failed to fetch");
      }

      return jsonResponse(jobView({ status: "processing", phase: "processing" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-testid="upload-poll-warning"]').text()).toContain("Unable to check status");
    expect(wrapper.text()).not.toContain("The video could not be processed.");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.find('[data-testid="upload-poll-warning"]').exists()).toBe(false);
    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
  });

  it("shows mapped errors for 409, 413, and network failures", async () => {
    const postResponses = [
      jsonResponse({ error: { message: "A video processing job is already active." } }, false, 409),
      jsonResponse({ error: { message: "The uploaded video exceeds the size limit." } }, false, 413),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (String(input) === "/api/admin/uploads" && init?.method === "POST") {
        const next = postResponses.shift();
        if (next !== undefined) {
          return next;
        }

        throw new TypeError("Failed to fetch");
      }

      return noActiveUpload();
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper, "one.mp4");
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("A video is already being processed.");

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The video exceeds the maximum allowed size.");

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The video could not be uploaded. Check your connection.");
  });

  it("recovers the current job when a 409 response includes a jobId", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (String(input) === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse(
          {
            error: { message: "A video processing job is already active." },
            jobId: "job-active",
          },
          false,
          409,
        );
      }

      if (String(input) === "/api/admin/uploads/job-active") {
        return jsonResponse(jobView({ jobId: "job-active", status: "processing", phase: "processing" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
    expect(wrapper.text()).toContain("Video in progress");
    expect(wrapper.text()).not.toContain("A video is already being processed.");
  });

  it("shows the uploading steps before the POST finishes", async () => {
    let releasePost: (() => void) | undefined;
    const postGate = new Promise<void>((resolve) => {
      releasePost = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (url === "/api/admin/uploads" && init?.method === "POST") {
        await postGate;
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      if (url === "/api/admin/uploads/job-1") {
        return jsonResponse(jobView({ status: "uploading", phase: "uploading" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper, "clip.mp4");
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Video in progress");
    expect(wrapper.get('[data-step="uploading"]').classes()).toContain("is-current");
    expect(wrapper.find('[data-testid="upload-submit"]').exists()).toBe(false);
    expect(
      fetchMock.mock.calls.filter(([url, init]) => String(url) === "/api/admin/uploads" && init?.method === "POST"),
    ).toHaveLength(1);

    releasePost?.();
    await flushPromises();
    await flushPromises();
    expect(wrapper.get('[data-step="uploading"]').classes()).toContain("is-current");
  });

  it("attaches to the active job when a 409 has no jobId", async () => {
    let activeCalls = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        activeCalls += 1;
        if (activeCalls === 1) {
          return noActiveUpload();
        }

        return jsonResponse(jobView({ jobId: "job-active", status: "processing", phase: "processing" }));
      }

      if (url === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ error: { message: "A video processing job is already active." } }, false, 409);
      }

      if (url === "/api/admin/uploads/job-active") {
        return jsonResponse(jobView({ jobId: "job-active", status: "processing", phase: "processing" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
    expect(wrapper.text()).toContain("Video in progress");
    expect(wrapper.text()).not.toContain("A video is already being processed.");
  });

  it("does not start a second POST when an active job is found first", async () => {
    let releaseActive: (() => void) | undefined;
    const activeGate = new Promise<void>((resolve) => {
      releaseActive = resolve;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        await activeGate;
        return jsonResponse(jobView({ status: "processing", phase: "processing", progress: 18 }));
      }

      if (url === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-new", status: "uploading" }, true, 202);
      }

      if (url === "/api/admin/uploads/job-1") {
        return jsonResponse(jobView({ status: "processing", phase: "processing", progress: 18 }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();

    expect(
      fetchMock.mock.calls.some(([url, init]) => String(url) === "/api/admin/uploads" && init?.method === "POST"),
    ).toBe(false);

    releaseActive?.();
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
    expect(
      fetchMock.mock.calls.some(([url, init]) => String(url) === "/api/admin/uploads" && init?.method === "POST"),
    ).toBe(false);
  });

  it("does not mark the job failed when status polling returns 404", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (String(input) === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      return jsonResponse({ error: { message: "Unknown upload job." } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.get('[data-testid="upload-poll-warning"]').text()).toBe(
      "The upload status could not be found.",
    );
    expect(wrapper.text()).not.toContain("The video could not be processed.");

    const getCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 2);
    await flushPromises();
    const getCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(getCallsAfter).toBe(getCallsBefore);
  });

  it("maps 400 and 500 upload responses to safe messages", async () => {
    const postResponses = [
      jsonResponse({ error: { message: "A video file is required." } }, false, 400),
      jsonResponse({ error: { message: "Video processing failed." } }, false, 500),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (String(input) === "/api/admin/uploads" && init?.method === "POST") {
        return postResponses.shift() ?? noActiveUpload();
      }

      return noActiveUpload();
    });
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The selected video is not valid.");

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("The video could not be processed.");
  });

  it("opens the upload page from admin videos and shows the new video under Untagged", async () => {
    const uploaded: SearchResultItem = {
      id: "clip.mp4",
      name: "clip.mp4",
      thumbnail: "/api/thumbnail/clip.mp4",
      video: "/api/video/clip.mp4",
      tags: [],
      recordedAt: null,
    };
    let catalog = [...catalogVideos];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        return noActiveUpload();
      }

      if (url === "/api/tags") {
        return jsonResponse({ count: 1, tags: tagItems("salsa") });
      }

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: catalog.length, results: catalog });
      }

      if (url === "/api/admin/uploads" && init?.method === "POST") {
        return jsonResponse({ jobId: "job-1", status: "uploading" }, true, 202);
      }

      if (url === "/api/admin/uploads/job-1") {
        catalog = [...catalogVideos, uploaded];
        return jsonResponse(jobView({ status: "completed", phase: "completed", videoId: "clip.mp4" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createUploadRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Untagged (1)");
    expect(wrapper.find('[data-testid="upload-select"]').exists()).toBe(false);

    await wrapper.get('[data-testid="upload-new-video"]').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("admin-video-upload");
    expect(wrapper.get('[data-testid="upload-new-video"]').classes()).toContain("active");
    expect(wrapper.get('[data-testid="nav-view"]').classes()).not.toContain("active");

    await chooseFile(wrapper, "clip.mp4");
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("Video added successfully");
    await wrapper.get('[data-testid="upload-view-untagged"]').trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.name).toBe("home");
    expect(wrapper.text()).toContain("Untagged (2)");
    expect(wrapper.find('a[aria-label="Edit tags for clip.mp4"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="filter-untagged"]').classes()).toContain("active");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
  });

  it("resumes an active upload when entering /admin/videos/upload", async () => {
    const states: UploadJobView[] = [
      jobView({
        status: "processing",
        phase: "processing",
        videoId: "PXL_20260813_214135367.TS.mp4",
        converted: true,
        progress: 47,
      }),
      jobView({
        status: "processing",
        phase: "generating_thumbnail",
        videoId: "PXL_20260813_214135367.TS.mp4",
        converted: true,
        progress: 100,
      }),
      jobView({
        status: "processing",
        phase: "installing",
        videoId: "PXL_20260813_214135367.TS.mp4",
        converted: true,
        progress: 100,
      }),
      jobView({
        status: "completed",
        phase: "completed",
        videoId: "PXL_20260813_214135367.TS.mp4",
        converted: true,
        progress: 100,
      }),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        return jsonResponse(states[0]);
      }

      if (url === "/api/admin/uploads/job-1") {
        return jsonResponse(states.shift() ?? jobView({ status: "completed", phase: "completed" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createUploadRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/videos/upload");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/uploads/active");
    expect(wrapper.text()).toContain("Video in progress");
    expect(wrapper.get('[data-testid="upload-file-name"]').text()).toBe("PXL_20260813_214135367.TS.mp4");
    expect(wrapper.find('[data-testid="upload-select"]').exists()).toBe(false);
    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
    expect(wrapper.get('[data-step="processing"]').text()).toContain("47%");
    expect(wrapper.find('[data-testid="upload-progress-bar"]').exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="generating_thumbnail"]').classes()).toContain("is-current");
    expect(wrapper.get('[data-step="generating_thumbnail"]').text()).toContain("Generating thumbnail");
    expect(wrapper.find('[data-testid="upload-progress-bar"]').exists()).toBe(false);

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="installing"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-testid="upload-success"]').text()).toBe("Video added successfully");
    expect(wrapper.find('[data-testid="upload-view-untagged"]').exists()).toBe(true);

    const pollCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 3);
    await flushPromises();
    const pollCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(pollCallsAfter).toBe(pollCallsBefore);
  });

  it("stops polling a recovered job when it fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/uploads/active") {
        return jsonResponse(jobView({ status: "processing", phase: "processing", progress: 12 }));
      }

      if (url === "/api/admin/uploads/job-1") {
        return jsonResponse(jobView({ status: "failed", phase: "failed" }));
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createUploadRouter();
    const Root = defineComponent({
      template: "<router-view />",
    });
    await router.push("/admin/videos/upload");
    await router.isReady();
    const wrapper = mount(Root, {
      global: { plugins: [router] },
    });
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("The video could not be processed.");
    const pollCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 2);
    await flushPromises();
    const pollCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(pollCallsAfter).toBe(pollCallsBefore);
  });

  it("does not add the upload zone to the consumer view", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/tags") {
        return jsonResponse({ count: 1, tags: tagItems("salsa") });
      }

      if (url === "/api/search") {
        return jsonResponse({ query: { tags: [] }, count: 0, results: [] });
      }

      return jsonResponse({ error: { message: "Not found" } }, false, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const router = createUploadRouter();
    await router.push("/");
    await router.isReady();
    const wrapper = mount(AdminVideosView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="upload-select"]').exists()).toBe(false);
    expect(wrapper.get('[data-testid="upload-new-video"]').text()).toBe("Upload video");
    expect(wrapper.find('button[aria-label="Refresh library"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="nav-view"]').classes()).toContain("active");
    expect(wrapper.text()).not.toContain("Select video");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/search");
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });
});

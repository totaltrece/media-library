import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";

import type { SearchResultItem, UploadJobView } from "../src/api/types.js";
import AdminVideoUpload from "../src/components/AdminVideoUpload.vue";
import TagSearch from "../src/components/TagSearch.vue";
import AdminTagsView from "../src/views/AdminTagsView.vue";
import AdminVideoEditView from "../src/views/AdminVideoEditView.vue";
import AdminVideosView from "../src/views/AdminVideosView.vue";
import HomeView from "../src/views/HomeView.vue";
import { UPLOAD_POLL_INTERVAL_MS } from "../src/utils/upload-job.js";

const catalogVideos: SearchResultItem[] = [
  {
    id: "untagged.mp4",
    name: "20260801_new.mp4",
    thumbnail: "/api/thumbnail/untagged.mp4",
    video: "/api/video/untagged.mp4",
    tags: [],
  },
  {
    id: "salsa/first.mp4",
    name: "first.mp4",
    thumbnail: "/api/thumbnail/salsa/first.mp4",
    video: "/api/video/salsa/first.mp4",
    tags: ["salsa"],
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
    outputs: null,
    ...partial,
  };
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

describe("admin video upload", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useFakeTimers({
      toFake: ["setInterval", "clearInterval"],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the upload zone and selected file name", async () => {
    const wrapper = mount(AdminVideoUpload);
    expect(wrapper.text()).toContain("Subir vídeo");
    expect(wrapper.get('[data-testid="upload-select"]').text()).toContain("Seleccionar vídeo");

    await chooseFile(wrapper, "PXL_clip.mp4");
    expect(wrapper.get('[data-testid="upload-file-name"]').text()).toBe("PXL_clip.mp4");
  });

  it("asks for a file before uploading", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(AdminVideoUpload);

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("Selecciona un vídeo primero.");
  });

  it("posts multipart without a manual content-type and polls job status", async () => {
    const states: UploadJobView[] = [
      jobView({ status: "uploading", phase: "uploading" }),
      jobView({ status: "processing", phase: "processing" }),
      jobView({ status: "processing", phase: "generating_thumbnail" }),
      jobView({ status: "processing", phase: "installing" }),
      jobView({ status: "completed", phase: "completed", converted: true }),
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

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
    const postInit = fetchMock.mock.calls[0]?.[1];
    expect(postInit?.headers).toBeUndefined();
    expect((postInit?.body as FormData).get("video")).toBe(file);
    expect(wrapper.emitted("completed")).toBeUndefined();
    expect(wrapper.text()).toContain("Hay un vídeo en proceso");
    expect(wrapper.get('[data-testid="upload-select"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-testid="upload-submit"]').attributes("disabled")).toBeDefined();
    expect(wrapper.get('[data-step="uploading"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="generating_thumbnail"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-step="installing"]').classes()).toContain("is-current");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.get('[data-testid="upload-success"]').text()).toBe("Vídeo añadido correctamente");
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

    expect(wrapper.text()).toContain("No se ha podido procesar el vídeo.");
    expect(wrapper.text()).not.toContain("C:\\secret");

    const getCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 2);
    await flushPromises();
    const getCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(getCallsAfter).toBe(getCallsBefore);
  });

  it("clears the polling timer on unmount", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

    expect(wrapper.get('[data-testid="upload-poll-warning"]').text()).toContain("No se puede consultar el estado");
    expect(wrapper.text()).not.toContain("No se ha podido procesar el vídeo.");

    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS);
    await flushPromises();
    expect(wrapper.find('[data-testid="upload-poll-warning"]').exists()).toBe(false);
    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
  });

  it("shows mapped errors for 409, 413, and network failures", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "A video processing job is already active." } }, false, 409))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "The uploaded video exceeds the size limit." } }, false, 413))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper, "one.mp4");
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Ya hay un vídeo en proceso.");

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("El vídeo supera el tamaño máximo permitido.");

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("No se ha podido enviar el vídeo. Comprueba la conexión.");
  });

  it("recovers the current job when a 409 response includes a jobId", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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

    expect(wrapper.text()).toContain("Ya hay un vídeo en proceso.");
    expect(wrapper.get('[data-step="processing"]').classes()).toContain("is-current");
  });

  it("does not mark the job failed when status polling returns 404", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
      "No se ha encontrado el estado de la subida.",
    );
    expect(wrapper.text()).not.toContain("No se ha podido procesar el vídeo.");

    const getCallsBefore = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    await vi.advanceTimersByTimeAsync(UPLOAD_POLL_INTERVAL_MS * 2);
    await flushPromises();
    const getCallsAfter = fetchMock.mock.calls.filter(([url]) => String(url) === "/api/admin/uploads/job-1").length;
    expect(getCallsAfter).toBe(getCallsBefore);
  });

  it("maps 400 and 500 upload responses to safe messages", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "A video file is required." } }, false, 400))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "Video processing failed." } }, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = mount(AdminVideoUpload);
    await chooseFile(wrapper);

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("El vídeo seleccionado no es válido.");

    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("No se ha podido procesar el vídeo.");
  });

  it("refreshes the catalog into Sin tags after a completed upload", async () => {
    const uploaded: SearchResultItem = {
      id: "clip.mp4",
      name: "clip.mp4",
      thumbnail: "/api/thumbnail/clip.mp4",
      video: "/api/video/clip.mp4",
      tags: [],
    };
    let catalog = [...catalogVideos];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/tags") {
        return jsonResponse({ count: 1, tags: ["salsa"] });
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

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: HomeView },
        { path: "/admin/videos", name: "admin-videos", component: AdminVideosView },
        { path: "/admin/tags", name: "admin-tags", component: AdminTagsView },
        {
          path: "/admin/videos/:id(.*)",
          name: "admin-video-edit",
          component: AdminVideoEditView,
          props: true,
        },
      ],
    });
    await router.push("/admin/videos");
    await router.isReady();
    const wrapper = mount(AdminVideosView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("Sin tags (1)");
    await chooseFile(wrapper, "clip.mp4");
    await wrapper.get('[data-testid="upload-submit"]').trigger("click");
    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("Vídeo añadido correctamente");
    expect(wrapper.text()).toContain("Sin tags (2)");
    expect(wrapper.text()).toContain("clip.mp4");
    expect(wrapper.get('[data-testid="filter-untagged"]').classes()).toContain("active");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
  });

  it("does not add the upload zone to the consumer view", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ count: 1, tags: ["salsa"] }));
    vi.stubGlobal("fetch", fetchMock);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: HomeView },
        { path: "/admin/videos", name: "admin-videos", component: AdminVideosView },
        { path: "/admin/tags", name: "admin-tags", component: AdminTagsView },
      ],
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(HomeView, {
      global: { plugins: [router] },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="upload-select"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Seleccionar vídeo");
    expect(wrapper.text()).not.toContain("Subir vídeo");
    expect(wrapper.findComponent(TagSearch).exists()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/search");
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "POST"),
    ).toBe(false);
  });
});

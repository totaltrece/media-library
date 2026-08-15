import Fastify from "fastify";

import { AddVideoTagUseCase } from "./application/add-video-tag.js";
import { DeleteTagUseCase } from "./application/delete-tag.js";
import { CompleteUploadUseCase } from "./application/complete-upload.js";
import { GetTagsUseCase } from "./application/get-tags.js";
import { GetThumbnailUseCase } from "./application/get-thumbnail.js";
import { GetUploadJobUseCase } from "./application/get-upload-job.js";
import { GetVideoTagsUseCase } from "./application/get-video-tags.js";
import { InstallProcessedUploadUseCase } from "./application/install-processed-upload.js";
import { ListTagCatalogUseCase } from "./application/list-tag-catalog.js";
import type { ProcessVideoJobUseCase } from "./application/process-video-job.js";
import type { RefreshLibraryUseCase } from "./application/refresh-library.js";
import { RemoveVideoTagUseCase } from "./application/remove-video-tag.js";
import { RenameTagUseCase } from "./application/rename-tag.js";
import { SearchVideosUseCase } from "./application/search-videos.js";
import { SetVideoTagsUseCase } from "./application/set-video-tags.js";
import { StreamVideoUseCase } from "./application/stream-video.js";
import { FilesystemLibraryMediaInstaller } from "./adapters/filesystem/filesystem-library-media-installer.js";
import { FilesystemVideoStore } from "./adapters/filesystem/filesystem-video-store.js";
import { TagSpacesThumbnailStore } from "./adapters/filesystem/tagspaces-thumbnail-store.js";
import { registerAdminTagsRoutes } from "./adapters/http/admin-tags-controller.js";
import { registerLibraryRoutes } from "./adapters/http/library-controller.js";
import { registerSearchRoutes } from "./adapters/http/search-controller.js";
import { registerStaticFrontend } from "./adapters/http/register-static-frontend.js";
import { registerTagsRoutes } from "./adapters/http/tags-controller.js";
import { registerThumbnailRoutes } from "./adapters/http/thumbnail-controller.js";
import { registerUploadsRoutes } from "./adapters/http/uploads-controller.js";
import { registerVideoRoutes } from "./adapters/http/video-controller.js";
import { registerVideoTagsRoutes } from "./adapters/http/video-tags-controller.js";
import type { LibraryMediaInstaller } from "./ports/library-media-installer.js";
import type { LibraryStore } from "./ports/library-store.js";
import type { ProcessingJobStore } from "./ports/processing-job-store.js";
import { isMutableVideoIndex, type VideoIndex } from "./ports/video-index.js";

export interface AppDependencies {
  videoIndex: VideoIndex;
  libraryPath: string;
  staticRoot?: string;
  refreshLibraryUseCase?: RefreshLibraryUseCase;
  libraryStore?: LibraryStore;
  processVideoJobUseCase?: ProcessVideoJobUseCase;
  processingJobStore?: ProcessingJobStore;
  libraryMediaInstaller?: LibraryMediaInstaller;
  uploadMaxBytes?: number;
}

export async function createApp(dependencies: AppDependencies) {
  const uploadMaxBytes = dependencies.uploadMaxBytes;
  const app = Fastify({
    logger: false,
    ...(uploadMaxBytes === undefined ? {} : { bodyLimit: uploadMaxBytes + 1024 * 1024 }),
  });

  const searchVideosUseCase = new SearchVideosUseCase(dependencies.videoIndex);
  const getTagsUseCase = new GetTagsUseCase(dependencies.videoIndex);
  const getThumbnailUseCase = new GetThumbnailUseCase(
    new TagSpacesThumbnailStore(dependencies.libraryPath),
  );
  const streamVideoUseCase = new StreamVideoUseCase(
    new FilesystemVideoStore(dependencies.libraryPath),
  );

  await app.register(async (api) => {
    api.get("/health", async () => {
      return { status: "ok" };
    });

    registerSearchRoutes(api, {
      libraryPath: dependencies.libraryPath,
      searchVideosUseCase,
    });

    registerTagsRoutes(api, {
      getTagsUseCase,
    });

    registerThumbnailRoutes(api, {
      getThumbnailUseCase,
    });

    registerVideoRoutes(api, {
      streamVideoUseCase,
    });

    if (dependencies.refreshLibraryUseCase !== undefined) {
      registerLibraryRoutes(api, {
        refreshLibraryUseCase: dependencies.refreshLibraryUseCase,
      });
    }

    if (dependencies.libraryStore !== undefined && isMutableVideoIndex(dependencies.videoIndex)) {
      registerVideoTagsRoutes(api, {
        getVideoTagsUseCase: new GetVideoTagsUseCase(dependencies.libraryStore),
        addVideoTagUseCase: new AddVideoTagUseCase(
          dependencies.libraryStore,
          dependencies.videoIndex,
          dependencies.libraryPath,
        ),
        removeVideoTagUseCase: new RemoveVideoTagUseCase(
          dependencies.libraryStore,
          dependencies.videoIndex,
          dependencies.libraryPath,
        ),
        setVideoTagsUseCase: new SetVideoTagsUseCase(
          dependencies.libraryStore,
          dependencies.videoIndex,
          dependencies.libraryPath,
        ),
      });

      registerAdminTagsRoutes(api, {
        listTagCatalogUseCase: new ListTagCatalogUseCase(dependencies.libraryStore),
        renameTagUseCase: new RenameTagUseCase(
          dependencies.libraryStore,
          dependencies.videoIndex,
          dependencies.libraryPath,
        ),
        deleteTagUseCase: new DeleteTagUseCase(
          dependencies.libraryStore,
          dependencies.videoIndex,
          dependencies.libraryPath,
        ),
      });
    }

    if (
      dependencies.processVideoJobUseCase !== undefined &&
      dependencies.processingJobStore !== undefined &&
      dependencies.libraryStore !== undefined &&
      isMutableVideoIndex(dependencies.videoIndex) &&
      uploadMaxBytes !== undefined
    ) {
      const installer = dependencies.libraryMediaInstaller
        ?? new FilesystemLibraryMediaInstaller(dependencies.libraryPath);
      const installProcessedUploadUseCase = new InstallProcessedUploadUseCase(
        installer,
        dependencies.libraryStore,
        dependencies.videoIndex,
        dependencies.processingJobStore,
        dependencies.libraryPath,
      );

      await registerUploadsRoutes(api, {
        processVideoJobUseCase: dependencies.processVideoJobUseCase,
        completeUploadUseCase: new CompleteUploadUseCase(
          dependencies.processVideoJobUseCase,
          installProcessedUploadUseCase,
        ),
        getUploadJobUseCase: new GetUploadJobUseCase(dependencies.processingJobStore),
        uploadMaxBytes,
      });
    }
  }, { prefix: "/api" });

  if (dependencies.staticRoot !== undefined) {
    await registerStaticFrontend(app, dependencies.staticRoot);
  }

  return app;
}

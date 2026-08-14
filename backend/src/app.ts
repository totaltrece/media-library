import Fastify from "fastify";

import { AddVideoTagUseCase } from "./application/add-video-tag.js";
import { GetTagsUseCase } from "./application/get-tags.js";
import { GetThumbnailUseCase } from "./application/get-thumbnail.js";
import { GetVideoTagsUseCase } from "./application/get-video-tags.js";
import type { RefreshLibraryUseCase } from "./application/refresh-library.js";
import { RemoveVideoTagUseCase } from "./application/remove-video-tag.js";
import { SearchVideosUseCase } from "./application/search-videos.js";
import { SetVideoTagsUseCase } from "./application/set-video-tags.js";
import { StreamVideoUseCase } from "./application/stream-video.js";
import { FilesystemVideoStore } from "./adapters/filesystem/filesystem-video-store.js";
import { TagSpacesThumbnailStore } from "./adapters/filesystem/tagspaces-thumbnail-store.js";
import { registerLibraryRoutes } from "./adapters/http/library-controller.js";
import { registerSearchRoutes } from "./adapters/http/search-controller.js";
import { registerStaticFrontend } from "./adapters/http/register-static-frontend.js";
import { registerTagsRoutes } from "./adapters/http/tags-controller.js";
import { registerThumbnailRoutes } from "./adapters/http/thumbnail-controller.js";
import { registerVideoRoutes } from "./adapters/http/video-controller.js";
import { registerVideoTagsRoutes } from "./adapters/http/video-tags-controller.js";
import type { LibraryStore } from "./ports/library-store.js";
import { isMutableVideoIndex, type VideoIndex } from "./ports/video-index.js";

export interface AppDependencies {
  videoIndex: VideoIndex;
  libraryPath: string;
  staticRoot?: string;
  refreshLibraryUseCase?: RefreshLibraryUseCase;
  libraryStore?: LibraryStore;
}

export async function createApp(dependencies: AppDependencies) {
  const app = Fastify({ logger: false });

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
    }
  }, { prefix: "/api" });

  if (dependencies.staticRoot !== undefined) {
    await registerStaticFrontend(app, dependencies.staticRoot);
  }

  return app;
}

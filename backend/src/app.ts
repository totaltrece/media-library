import Fastify from "fastify";

import { WorkspaceLibraryIndexer } from "./adapters/indexer/workspace-library-indexer.js";
import { GetTagsUseCase } from "./application/get-tags.js";
import { GetThumbnailUseCase } from "./application/get-thumbnail.js";
import { RefreshLibraryUseCase } from "./application/refresh-library.js";
import { SearchVideosUseCase } from "./application/search-videos.js";
import { StreamVideoUseCase } from "./application/stream-video.js";
import { FilesystemVideoStore } from "./adapters/filesystem/filesystem-video-store.js";
import { TagSpacesThumbnailStore } from "./adapters/filesystem/tagspaces-thumbnail-store.js";
import { registerLibraryRoutes } from "./adapters/http/library-controller.js";
import { registerSearchRoutes } from "./adapters/http/search-controller.js";
import { registerStaticFrontend } from "./adapters/http/register-static-frontend.js";
import { registerTagsRoutes } from "./adapters/http/tags-controller.js";
import { registerThumbnailRoutes } from "./adapters/http/thumbnail-controller.js";
import { registerVideoRoutes } from "./adapters/http/video-controller.js";
import { isMutableVideoIndex, type VideoIndex } from "./ports/video-index.js";

export interface AppDependencies {
  videoIndex: VideoIndex;
  libraryPath: string;
  staticRoot?: string;
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

    if (isMutableVideoIndex(dependencies.videoIndex)) {
      registerLibraryRoutes(api, {
        refreshLibraryUseCase: new RefreshLibraryUseCase(
          new WorkspaceLibraryIndexer(dependencies.libraryPath),
          dependencies.videoIndex,
        ),
      });
    }
  }, { prefix: "/api" });

  if (dependencies.staticRoot !== undefined) {
    await registerStaticFrontend(app, dependencies.staticRoot);
  }

  return app;
}

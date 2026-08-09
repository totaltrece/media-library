import Fastify from "fastify";

import { GetThumbnailUseCase } from "./application/get-thumbnail.js";
import { SearchVideosUseCase } from "./application/search-videos.js";
import { TagSpacesThumbnailStore } from "./adapters/filesystem/tagspaces-thumbnail-store.js";
import { registerSearchRoutes } from "./adapters/http/search-controller.js";
import { registerThumbnailRoutes } from "./adapters/http/thumbnail-controller.js";
import type { VideoIndex } from "./ports/video-index.js";

export interface AppDependencies {
  videoIndex: VideoIndex;
  libraryPath: string;
}

export async function createApp(dependencies: AppDependencies) {
  const app = Fastify({ logger: false });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  const searchVideosUseCase = new SearchVideosUseCase(dependencies.videoIndex);
  const getThumbnailUseCase = new GetThumbnailUseCase(
    new TagSpacesThumbnailStore(dependencies.libraryPath),
  );

  registerSearchRoutes(app, {
    libraryPath: dependencies.libraryPath,
    searchVideosUseCase,
  });

  registerThumbnailRoutes(app, {
    getThumbnailUseCase,
  });

  return app;
}

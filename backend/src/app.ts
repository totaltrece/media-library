import Fastify from "fastify";

import { GetTagsUseCase } from "./application/get-tags.js";
import { GetThumbnailUseCase } from "./application/get-thumbnail.js";
import { SearchVideosUseCase } from "./application/search-videos.js";
import { StreamVideoUseCase } from "./application/stream-video.js";
import { FilesystemVideoStore } from "./adapters/filesystem/filesystem-video-store.js";
import { TagSpacesThumbnailStore } from "./adapters/filesystem/tagspaces-thumbnail-store.js";
import { registerSearchRoutes } from "./adapters/http/search-controller.js";
import { registerTagsRoutes } from "./adapters/http/tags-controller.js";
import { registerThumbnailRoutes } from "./adapters/http/thumbnail-controller.js";
import { registerVideoRoutes } from "./adapters/http/video-controller.js";
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
  const getTagsUseCase = new GetTagsUseCase(dependencies.videoIndex);
  const getThumbnailUseCase = new GetThumbnailUseCase(
    new TagSpacesThumbnailStore(dependencies.libraryPath),
  );
  const streamVideoUseCase = new StreamVideoUseCase(
    new FilesystemVideoStore(dependencies.libraryPath),
  );

  registerSearchRoutes(app, {
    libraryPath: dependencies.libraryPath,
    searchVideosUseCase,
  });

  registerTagsRoutes(app, {
    getTagsUseCase,
  });

  registerThumbnailRoutes(app, {
    getThumbnailUseCase,
  });

  registerVideoRoutes(app, {
    streamVideoUseCase,
  });

  return app;
}

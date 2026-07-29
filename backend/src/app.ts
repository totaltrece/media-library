import Fastify from "fastify";

import { SearchVideosUseCase } from "./application/search-videos.js";
import { registerSearchRoutes } from "./adapters/http/search-controller.js";
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

  registerSearchRoutes(app, {
    libraryPath: dependencies.libraryPath,
    searchVideosUseCase,
  });

  return app;
}

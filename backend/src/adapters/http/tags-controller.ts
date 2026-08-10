import type { FastifyInstance } from "fastify";

import type { GetTagsUseCase } from "../../application/get-tags.js";

export interface TagsControllerOptions {
  getTagsUseCase: GetTagsUseCase;
}

export function registerTagsRoutes(
  app: FastifyInstance,
  options: TagsControllerOptions,
): void {
  app.get("/tags", async () => {
    return options.getTagsUseCase.execute();
  });
}

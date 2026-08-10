import type { FastifyInstance } from "fastify";

import type { RefreshLibraryUseCase } from "../../application/refresh-library.js";

export interface LibraryControllerOptions {
  refreshLibraryUseCase: RefreshLibraryUseCase;
}

export function registerLibraryRoutes(
  app: FastifyInstance,
  options: LibraryControllerOptions,
): void {
  app.post("/library/refresh", async (_request, reply) => {
    try {
      return await options.refreshLibraryUseCase.execute();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to refresh library index";

      return reply.status(500).send({
        error: {
          message,
        },
      });
    }
  });
}

import type { FastifyInstance, FastifyRequest } from "fastify";

import type { GetThumbnailUseCase } from "../../application/get-thumbnail.js";

export interface ThumbnailControllerOptions {
  getThumbnailUseCase: GetThumbnailUseCase;
}

export function registerThumbnailRoutes(
  app: FastifyInstance,
  options: ThumbnailControllerOptions,
): void {
  app.get("/thumbnail/*", async (request, reply) => {
    const mediaId = getMediaIdFromRequest(request);
    const thumbnail = await options.getThumbnailUseCase.execute(mediaId);

    if (thumbnail === null) {
      return reply.status(404).send({
        error: {
          message: "Thumbnail not found",
        },
      });
    }

    return reply.type(thumbnail.contentType).send(thumbnail.data);
  });
}

function getMediaIdFromRequest(request: FastifyRequest): string {
  const params = request.params as { "*": string };

  return params["*"];
}

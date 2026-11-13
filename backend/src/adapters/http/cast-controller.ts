import type { FastifyInstance, FastifyReply } from "fastify";

import type { IssueCastLinkUseCase } from "../../application/issue-cast-link.js";

export interface CastControllerOptions {
  issueCastLinkUseCase: IssueCastLinkUseCase;
}

export function registerCastRoutes(app: FastifyInstance, options: CastControllerOptions): void {
  app.post("/cast/links", async (request, reply) => {
    const mediaId = readMediaId(request.body);

    if (mediaId === undefined) {
      return sendError(reply, 400, "Video id is required");
    }

    const link = await options.issueCastLinkUseCase.execute(mediaId);

    if (link === null) {
      return sendError(reply, 404, "Video not found");
    }

    return reply.header("Cache-Control", "no-store").send(link);
  });
}

function readMediaId(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("id" in body) || typeof body.id !== "string") {
    return undefined;
  }

  const mediaId = body.id.trim();

  if (mediaId.length === 0 || mediaId.includes("\0")) {
    return undefined;
  }

  return mediaId;
}

function sendError(reply: FastifyReply, status: 400 | 404, message: string) {
  return reply.status(status).send({
    error: {
      message,
    },
  });
}

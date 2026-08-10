import { createReadStream } from "node:fs";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { parseRangeHeader } from "../../application/parse-range-header.js";
import type { StreamVideoUseCase } from "../../application/stream-video.js";

export interface VideoControllerOptions {
  streamVideoUseCase: StreamVideoUseCase;
}

export function registerVideoRoutes(
  app: FastifyInstance,
  options: VideoControllerOptions,
): void {
  app.get("/video/*", async (request, reply) => {
    const mediaId = getMediaIdFromRequest(request);
    const video = await options.streamVideoUseCase.execute(mediaId);

    if (video === null) {
      return reply.status(404).send({
        error: {
          message: "Video not found",
        },
      });
    }

    return sendVideoResponse(request, reply, video);
  });
}

async function sendVideoResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  video: { path: string; size: number; contentType: string },
) {
  const rangeHeader = getRangeHeader(request);
  const parsedRange = parseRangeHeader(rangeHeader, video.size);

  if (parsedRange.kind === "unsatisfiable") {
    return reply
      .code(416)
      .header("Content-Range", `bytes */${video.size}`)
      .send({
        error: {
          message: "Range not satisfiable",
        },
      });
  }

  reply.header("Accept-Ranges", "bytes");
  reply.type(video.contentType);

  if (parsedRange.kind === "full") {
    return reply
      .code(200)
      .header("Content-Length", video.size)
      .send(createReadStream(video.path));
  }

  const { start, end } = parsedRange.range;
  const contentLength = end - start + 1;

  return reply
    .code(206)
    .header("Content-Range", `bytes ${start}-${end}/${video.size}`)
    .header("Content-Length", contentLength)
    .send(createReadStream(video.path, { start, end }));
}

function getMediaIdFromRequest(request: FastifyRequest): string {
  const params = request.params as { "*": string };

  return params["*"];
}

function getRangeHeader(request: FastifyRequest): string | undefined {
  const rangeHeader = request.headers.range;

  return typeof rangeHeader === "string" ? rangeHeader : undefined;
}

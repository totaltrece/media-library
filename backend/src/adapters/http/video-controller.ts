import { createReadStream } from "node:fs";

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { contentDispositionAttachment, fileNameFromMediaId } from "../../application/content-disposition.js";
import { parseRangeHeader } from "../../application/parse-range-header.js";
import type { StreamVideoUseCase } from "../../application/stream-video.js";

export interface VideoControllerOptions {
  streamVideoUseCase: StreamVideoUseCase;
}

export function registerVideoRoutes(app: FastifyInstance, options: VideoControllerOptions): void {
  app.options("/video/*", async (_request, reply) => {
    applyVideoCors(reply);
    reply.header("Access-Control-Max-Age", "86400");
    return reply.code(204).send();
  });

  app.get("/video/*", async (request, reply) => {
    const mediaId = getMediaIdFromRequest(request);
    const video = await options.streamVideoUseCase.execute(mediaId);

    if (video === null) {
      applyVideoCors(reply);
      return reply.status(404).send({
        error: {
          message: "Video not found",
        },
      });
    }

    return sendVideoResponse(request, reply, video, mediaId);
  });
}

function applyVideoCors(reply: FastifyReply): void {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Range");
  reply.header(
    "Access-Control-Expose-Headers",
    "Accept-Ranges, Content-Disposition, Content-Length, Content-Range, Content-Type",
  );
}

async function sendVideoResponse(
  request: FastifyRequest,
  reply: FastifyReply,
  video: { path: string; size: number; contentType: string },
  mediaId: string,
) {
  const rangeHeader = getRangeHeader(request);
  const parsedRange = parseRangeHeader(rangeHeader, video.size);

  applyVideoCors(reply);

  if (hasCastToken(request)) {
    reply.header("Cache-Control", "private");
  }

  if (wantsDownload(request) && !hasCastToken(request)) {
    reply.header("Content-Disposition", contentDispositionAttachment(fileNameFromMediaId(mediaId)));
  }

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

function hasCastToken(request: FastifyRequest): boolean {
  return readQueryValue(request.query, "cast") !== undefined;
}

function wantsDownload(request: FastifyRequest): boolean {
  const download = readQueryValue(request.query, "download");

  return download === "1" || download === "true";
}

function readQueryValue(query: unknown, name: string): string | undefined {
  if (!isRecord(query) || !(name in query)) {
    return undefined;
  }

  const value = query[name];

  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

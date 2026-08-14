import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { AddVideoTagUseCase } from "../../application/add-video-tag.js";
import type { GetVideoTagsUseCase } from "../../application/get-video-tags.js";
import type { RemoveVideoTagUseCase } from "../../application/remove-video-tag.js";
import type { SetVideoTagsUseCase } from "../../application/set-video-tags.js";
import { VideoNotFoundError } from "../../application/video-not-found-error.js";

export interface VideoTagsControllerOptions {
  getVideoTagsUseCase: GetVideoTagsUseCase;
  addVideoTagUseCase: AddVideoTagUseCase;
  removeVideoTagUseCase: RemoveVideoTagUseCase;
  setVideoTagsUseCase: SetVideoTagsUseCase;
}

export function registerVideoTagsRoutes(
  app: FastifyInstance,
  options: VideoTagsControllerOptions,
): void {
  app.get("/videos/*", async (request, reply) => {
    const parsed = parseVideoTagsCollectionPath(getWildcardPath(request));

    if (parsed === undefined) {
      return sendBadRequest(reply, "Invalid video tags path");
    }

    return executeVideoTags(reply, () => options.getVideoTagsUseCase.execute(parsed.mediaId));
  });

  app.post("/videos/*", async (request, reply) => {
    const parsed = parseVideoTagsCollectionPath(getWildcardPath(request));

    if (parsed === undefined) {
      return sendBadRequest(reply, "Invalid video tags path");
    }

    const tagName = parseTagNameBody(request.body);

    if (tagName === undefined) {
      return sendBadRequest(reply, "Tag name is required");
    }

    return executeVideoTags(reply, () => options.addVideoTagUseCase.execute(parsed.mediaId, tagName));
  });

  app.put("/videos/*", async (request, reply) => {
    const parsed = parseVideoTagsCollectionPath(getWildcardPath(request));

    if (parsed === undefined) {
      return sendBadRequest(reply, "Invalid video tags path");
    }

    const tagNames = parseTagListBody(request.body);

    if (tagNames === undefined) {
      return sendBadRequest(reply, "Tag list is required");
    }

    return executeVideoTags(reply, () => options.setVideoTagsUseCase.execute(parsed.mediaId, tagNames));
  });

  app.delete("/videos/*", async (request, reply) => {
    const parsed = parseVideoTagsItemPath(getWildcardPath(request));

    if (parsed === undefined) {
      return sendBadRequest(reply, "Invalid video tags path");
    }

    return executeVideoTags(reply, () =>
      options.removeVideoTagUseCase.execute(parsed.mediaId, parsed.tagName),
    );
  });
}

export function parseVideoTagsCollectionPath(wildcardPath: string): { mediaId: string } | undefined {
  if (!wildcardPath.endsWith("/tags") || wildcardPath.endsWith("/tags/")) {
    return undefined;
  }

  const mediaId = wildcardPath.slice(0, -"/tags".length);

  return mediaId.length > 0 ? { mediaId } : undefined;
}

export function parseVideoTagsItemPath(
  wildcardPath: string,
): { mediaId: string; tagName: string } | undefined {
  const marker = "/tags/";
  const markerIndex = wildcardPath.lastIndexOf(marker);

  if (markerIndex <= 0) {
    return undefined;
  }

  const mediaId = wildcardPath.slice(0, markerIndex);
  const encodedTag = wildcardPath.slice(markerIndex + marker.length);

  if (mediaId.length === 0 || encodedTag.length === 0) {
    return undefined;
  }

  try {
    const tagName = decodeURIComponent(encodedTag);

    return tagName.length > 0 ? { mediaId, tagName } : undefined;
  } catch {
    return undefined;
  }
}

function getWildcardPath(request: FastifyRequest): string {
  const params = request.params as { "*": string };

  return params["*"] ?? "";
}

function parseTagNameBody(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null || !("name" in body) || typeof body.name !== "string") {
    return undefined;
  }

  return body.name.length > 0 ? body.name : undefined;
}

function parseTagListBody(body: unknown): string[] | undefined {
  if (typeof body !== "object" || body === null || !("tags" in body) || !Array.isArray(body.tags)) {
    return undefined;
  }

  if (!body.tags.every((tag): tag is string => typeof tag === "string" && tag.length > 0)) {
    return undefined;
  }

  return body.tags;
}

function sendBadRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      message,
    },
  });
}

function executeVideoTags(reply: FastifyReply, execute: () => { tags: string[] }) {
  try {
    return execute();
  } catch (error: unknown) {
    if (error instanceof VideoNotFoundError) {
      return reply.status(404).send({
        error: {
          message: error.message,
        },
      });
    }

    const message = error instanceof Error ? error.message : "Unable to update video tags";

    if (message.includes("Tag name must not be empty")) {
      return sendBadRequest(reply, message);
    }

    return reply.status(500).send({
      error: {
        message,
      },
    });
  }
}

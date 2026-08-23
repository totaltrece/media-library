import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { DeleteTagUseCase } from "../../application/delete-tag.js";
import type { ListTagCatalogUseCase } from "../../application/list-tag-catalog.js";
import type { RenameTagUseCase } from "../../application/rename-tag.js";
import { TagNameConflictError } from "../../application/tag-name-conflict-error.js";
import { TagNotFoundError } from "../../application/tag-not-found-error.js";
import { TagTypeNotFoundError } from "../../application/tag-type-not-found-error.js";

export interface AdminTagsControllerOptions {
  listTagCatalogUseCase: ListTagCatalogUseCase;
  renameTagUseCase: RenameTagUseCase;
  deleteTagUseCase: DeleteTagUseCase;
}

export function registerAdminTagsRoutes(
  app: FastifyInstance,
  options: AdminTagsControllerOptions,
): void {
  app.get("/admin/tags", async () => {
    return options.listTagCatalogUseCase.execute();
  });

  app.put("/admin/tags/:id", async (request, reply) => {
    const tagId = parseTagId(request);

    if (tagId === undefined) {
      return sendBadRequest(reply, "Tag id is required");
    }

    const body = parseTagUpdateBody(request.body);

    if (body === undefined) {
      return sendBadRequest(reply, "Tag name is required");
    }

    return executeAdminTag(reply, () => options.renameTagUseCase.execute(tagId, body.name, body.typeId));
  });

  app.delete("/admin/tags/:id", async (request, reply) => {
    const tagId = parseTagId(request);

    if (tagId === undefined) {
      return sendBadRequest(reply, "Tag id is required");
    }

    return executeAdminTag(reply, () => {
      options.deleteTagUseCase.execute(tagId);
      return { id: tagId };
    });
  });
}

function parseTagId(request: FastifyRequest): number | undefined {
  const params = request.params as { id?: string };
  const tagId = Number(params.id);

  return Number.isInteger(tagId) && tagId > 0 ? tagId : undefined;
}

function parseTagUpdateBody(body: unknown): { name: string; typeId?: number } | undefined {
  if (typeof body !== "object" || body === null || !("name" in body) || typeof body.name !== "string") {
    return undefined;
  }

  if (!("typeId" in body) || body.typeId === undefined) {
    return { name: body.name };
  }

  if (typeof body.typeId !== "number" || !Number.isInteger(body.typeId) || body.typeId <= 0) {
    return undefined;
  }

  return {
    name: body.name,
    typeId: body.typeId,
  };
}

function sendBadRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      message,
    },
  });
}

function executeAdminTag<T>(reply: FastifyReply, execute: () => T) {
  try {
    return execute();
  } catch (error: unknown) {
    if (error instanceof TagNotFoundError || error instanceof TagTypeNotFoundError) {
      return reply.status(404).send({
        error: {
          message: error.message,
        },
      });
    }

    if (error instanceof TagNameConflictError) {
      return reply.status(409).send({
        error: {
          message: error.message,
        },
      });
    }

    const message = error instanceof Error ? error.message : "Unable to update tag";

    if (message.includes("Tag name must not be empty") || message.includes("Tag type not found")) {
      return sendBadRequest(reply, message);
    }

    return reply.status(500).send({
      error: {
        message,
      },
    });
  }
}

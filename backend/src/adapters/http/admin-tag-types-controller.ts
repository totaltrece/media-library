import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { CreateTagTypeUseCase } from "../../application/create-tag-type.js";
import { DefaultTagTypeProtectedError } from "../../application/default-tag-type-protected-error.js";
import type { DeleteTagTypeUseCase } from "../../application/delete-tag-type.js";
import { InvalidTagTypeColorError } from "../../application/invalid-tag-type-color-error.js";
import type { ListTagTypesUseCase } from "../../application/list-tag-types.js";
import { TagTypeInUseError } from "../../application/tag-type-in-use-error.js";
import { TagTypeNameConflictError } from "../../application/tag-type-name-conflict-error.js";
import { TagTypeNotFoundError } from "../../application/tag-type-not-found-error.js";
import type { UpdateTagTypeUseCase } from "../../application/update-tag-type.js";

export interface AdminTagTypesControllerOptions {
  listTagTypesUseCase: ListTagTypesUseCase;
  createTagTypeUseCase: CreateTagTypeUseCase;
  updateTagTypeUseCase: UpdateTagTypeUseCase;
  deleteTagTypeUseCase: DeleteTagTypeUseCase;
}

export function registerAdminTagTypesRoutes(
  app: FastifyInstance,
  options: AdminTagTypesControllerOptions,
): void {
  app.get("/admin/tag-types", async () => {
    return options.listTagTypesUseCase.execute();
  });

  app.post("/admin/tag-types", async (request, reply) => {
    const body = parseTagTypeBody(request.body);

    if (body === undefined) {
      return sendBadRequest(reply, "Tag type name and color are required");
    }

    return executeTagType(reply, () => options.createTagTypeUseCase.execute(body.name, body.color), 201);
  });

  app.put("/admin/tag-types/:id", async (request, reply) => {
    const tagTypeId = parseTagTypeId(request);

    if (tagTypeId === undefined) {
      return sendBadRequest(reply, "Tag type id is required");
    }

    const body = parseTagTypeBody(request.body);

    if (body === undefined) {
      return sendBadRequest(reply, "Tag type name and color are required");
    }

    return executeTagType(reply, () => options.updateTagTypeUseCase.execute(tagTypeId, body.name, body.color));
  });

  app.delete("/admin/tag-types/:id", async (request, reply) => {
    const tagTypeId = parseTagTypeId(request);

    if (tagTypeId === undefined) {
      return sendBadRequest(reply, "Tag type id is required");
    }

    return executeTagType(reply, () => {
      options.deleteTagTypeUseCase.execute(tagTypeId);
      return { id: tagTypeId };
    });
  });
}

function parseTagTypeId(request: FastifyRequest): number | undefined {
  const params = request.params as { id?: string };
  const tagTypeId = Number(params.id);

  return Number.isInteger(tagTypeId) && tagTypeId > 0 ? tagTypeId : undefined;
}

function parseTagTypeBody(body: unknown): { name: string; color: string } | undefined {
  if (
    typeof body !== "object" ||
    body === null ||
    !("name" in body) ||
    typeof body.name !== "string" ||
    !("color" in body) ||
    typeof body.color !== "string"
  ) {
    return undefined;
  }

  return {
    name: body.name,
    color: body.color,
  };
}

function sendBadRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      message,
    },
  });
}

function executeTagType<T>(reply: FastifyReply, execute: () => T, successStatus = 200) {
  try {
    const result = execute();

    if (successStatus !== 200) {
      return reply.status(successStatus).send(result);
    }

    return result;
  } catch (error: unknown) {
    if (error instanceof TagTypeNotFoundError) {
      return reply.status(404).send({
        error: {
          message: error.message,
        },
      });
    }

    if (error instanceof TagTypeNameConflictError) {
      return reply.status(409).send({
        error: {
          message: error.message,
        },
      });
    }

    if (error instanceof TagTypeInUseError || error instanceof DefaultTagTypeProtectedError) {
      return reply.status(409).send({
        error: {
          message: error.message,
        },
      });
    }

    if (error instanceof InvalidTagTypeColorError) {
      return sendBadRequest(reply, error.message);
    }

    const message = error instanceof Error ? error.message : "Unable to update tag type";

    if (message.includes("Tag type name must not be empty")) {
      return sendBadRequest(reply, message);
    }

    return reply.status(500).send({
      error: {
        message,
      },
    });
  }
}

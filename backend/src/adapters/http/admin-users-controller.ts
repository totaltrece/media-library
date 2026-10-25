import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { CannotDeleteAdminUserError } from "../../application/cannot-delete-admin-user-error.js";
import type { CreateUserUseCase } from "../../application/create-user.js";
import type { DeleteViewUserUseCase } from "../../application/delete-view-user.js";
import type { ListViewUsersUseCase } from "../../application/list-view-users.js";
import { UserNotFoundError } from "../../application/user-not-found-error.js";
import { UsernameConflictError } from "../../application/username-conflict-error.js";

export interface AdminUsersControllerOptions {
  listViewUsersUseCase: ListViewUsersUseCase;
  createUserUseCase: CreateUserUseCase;
  deleteViewUserUseCase: DeleteViewUserUseCase;
}

export function registerAdminUsersRoutes(app: FastifyInstance, options: AdminUsersControllerOptions): void {
  app.get("/admin/users", async () => {
    return options.listViewUsersUseCase.execute();
  });

  app.post("/admin/users", async (request, reply) => {
    const body = parseCreateViewUserBody(request.body);

    if (body === undefined) {
      return sendBadRequest(reply, "Username and password are required");
    }

    try {
      const user = await options.createUserUseCase.execute({
        username: body.username,
        password: body.password,
        role: "view",
      });
      return reply.status(201).send(user);
    } catch (error: unknown) {
      return sendUserError(reply, error);
    }
  });

  app.delete("/admin/users/:id", async (request, reply) => {
    const userId = parseUserId(request);

    if (userId === undefined) {
      return sendBadRequest(reply, "User id is required");
    }

    try {
      await options.deleteViewUserUseCase.execute(userId);
      return { id: userId };
    } catch (error: unknown) {
      return sendUserError(reply, error);
    }
  });
}

function parseUserId(request: FastifyRequest): number | undefined {
  const params = request.params as { id?: string };
  const userId = Number(params.id);

  return Number.isInteger(userId) && userId > 0 ? userId : undefined;
}

function parseCreateViewUserBody(body: unknown): { username: string; password: string } | undefined {
  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    !("password" in body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return undefined;
  }

  return {
    username: body.username,
    password: body.password,
  };
}

function sendBadRequest(reply: FastifyReply, message: string) {
  return reply.status(400).send({
    error: {
      message,
    },
  });
}

function sendUserError(reply: FastifyReply, error: unknown) {
  if (error instanceof UserNotFoundError) {
    return reply.status(404).send({
      error: {
        message: error.message,
      },
    });
  }

  if (error instanceof CannotDeleteAdminUserError) {
    return reply.status(403).send({
      error: {
        message: error.message,
      },
    });
  }

  if (error instanceof UsernameConflictError) {
    return reply.status(409).send({
      error: {
        message: error.message,
      },
    });
  }

  const message = error instanceof Error ? error.message : "Unable to update user";

  if (
    message.includes("Username must not be empty") ||
    message.includes("Username must be 64 characters") ||
    message.includes("Password must be at least")
  ) {
    return sendBadRequest(reply, message);
  }

  return reply.status(500).send({
    error: {
      message,
    },
  });
}

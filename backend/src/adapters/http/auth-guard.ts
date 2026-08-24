import type { FastifyReply, FastifyRequest } from "fastify";

import { authorizeRequest } from "../../application/auth-policy.js";
import { resolveSessionUser } from "../../application/resolve-session.js";
import type { AuthStore } from "../../ports/auth-store.js";
import { readSessionToken } from "./auth-controller.js";

export function createAuthGuard(authStore: AuthStore, publicRead: boolean) {
  return async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = resolveSessionUser(authStore, readSessionToken(request));
    const decision = authorizeRequest({
      method: request.method,
      path: request.url,
      principal,
      publicRead,
    });

    if (decision.ok) {
      return;
    }

    return reply.status(decision.status).send({
      error: {
        message: decision.message,
      },
    });
  };
}

import type { FastifyReply, FastifyRequest } from "fastify";

import { authorizeRequest } from "../../application/auth-policy.js";
import { mediaIdFromVideoStreamPath, verifyCastAccessToken } from "../../application/cast-access-token.js";
import { resolveSessionUser } from "../../application/resolve-session.js";
import type { AuthStore } from "../../ports/auth-store.js";
import { readSessionToken } from "./auth-controller.js";

export function createAuthGuard(authStore: AuthStore, publicRead: boolean, castUrlSecret: string) {
  return async function authGuard(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const principal = await resolveSessionUser(authStore, readSessionToken(request));
    const decision = authorizeRequest({
      method: request.method,
      path: request.url,
      principal,
      publicRead,
      castStreamAuthorized: castStreamAuthorized(request, castUrlSecret),
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

function castStreamAuthorized(request: FastifyRequest, secret: string): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  const mediaId = mediaIdFromVideoStreamPath(request.url);
  const token = readCastToken(request.query);

  if (mediaId === undefined || token === undefined) {
    return false;
  }

  return verifyCastAccessToken(mediaId, token, secret, new Date());
}

function readCastToken(query: unknown): string | undefined {
  if (typeof query !== "object" || query === null || !("cast" in query)) {
    return undefined;
  }

  const token = query.cast;

  return typeof token === "string" && token.length > 0 ? token : undefined;
}

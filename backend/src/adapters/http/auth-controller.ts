import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { InvalidCredentialsError } from "../../application/invalid-credentials-error.js";
import type { LoginUseCase } from "../../application/login.js";
import type { LogoutUseCase } from "../../application/logout.js";
import { resolveSessionUser } from "../../application/resolve-session.js";
import type { AuthStore, AuthUser } from "../../ports/auth-store.js";
import { SESSION_COOKIE_NAME } from "./session-cookie.js";

export interface AuthControllerOptions {
  authStore: AuthStore;
  loginUseCase: LoginUseCase;
  logoutUseCase: LogoutUseCase;
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthControllerOptions): void {
  app.post("/auth/login", async (request, reply) => {
    const credentials = parseLoginBody(request.body);

    if (credentials === undefined) {
      return reply.status(400).send({
        error: {
          message: "Username and password are required",
        },
      });
    }

    try {
      const result = options.loginUseCase.execute(credentials.username, credentials.password);
      reply.setCookie(SESSION_COOKIE_NAME, result.token, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        expires: result.expiresAt,
      });
      return toMeResponse(result.user);
    } catch (error: unknown) {
      if (error instanceof InvalidCredentialsError) {
        return reply.status(401).send({
          error: {
            message: error.message,
          },
        });
      }

      throw error;
    }
  });

  app.post("/auth/logout", async (request, reply) => {
    options.logoutUseCase.execute(readSessionToken(request));
    reply.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    return { authenticated: false };
  });

  app.get("/auth/me", async (request) => {
    const user = resolveSessionUser(options.authStore, readSessionToken(request));
    return toMeResponse(user);
  });
}

export function readSessionToken(request: FastifyRequest): string | undefined {
  const token = request.cookies[SESSION_COOKIE_NAME];
  return typeof token === "string" && token.length > 0 ? token : undefined;
}

function parseLoginBody(body: unknown): { username: string; password: string } | undefined {
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

function toMeResponse(user: AuthUser | null):
  | { authenticated: false }
  | { authenticated: true; username: string; role: AuthUser["role"] } {
  if (user === null) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    username: user.username,
    role: user.role,
  };
}

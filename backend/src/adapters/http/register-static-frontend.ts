import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

export async function registerStaticFrontend(
  app: FastifyInstance,
  staticRoot: string,
): Promise<void> {
  await app.register(fastifyStatic, {
    root: staticRoot,
    wildcard: false,
  });

  app.setNotFoundHandler(async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;

    if (path.startsWith("/api/") || path === "/api") {
      return reply.status(404).send({
        error: {
          message: "Not found",
        },
      });
    }

    return reply.sendFile("index.html");
  });
}

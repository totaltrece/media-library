import Fastify from "fastify";

export async function createApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => {
    return { status: "ok" };
  });

  return app;
}

import { createApp } from "./app.js";

const defaultPort = 3000;

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? defaultPort);
  const app = await createApp();

  try {
    await app.listen({ port, host: "0.0.0.0" });
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

void main();

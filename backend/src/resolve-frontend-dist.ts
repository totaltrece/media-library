import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveFrontendDistPath(fromModuleUrl: string): string {
  const currentDir = dirname(fileURLToPath(fromModuleUrl));

  return join(currentDir, "../../frontend/dist");
}

import { config } from "./config.js";
import { openSqliteStores } from "./adapters/sqlite/sqlite-library-store.js";
import { CreateUserUseCase } from "./application/create-user.js";
import { UsernameConflictError } from "./application/username-conflict-error.js";
import type { AuthRole } from "./ports/auth-store.js";

interface CliOptions {
  username: string;
  password: string;
  role: AuthRole;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const stores = openSqliteStores(config.sqlitePath);

  try {
    const user = await new CreateUserUseCase(stores.authStore).execute(options);
    console.log(`Created ${user.role} user: ${user.username}`);
  } catch (error: unknown) {
    if (error instanceof UsernameConflictError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  } finally {
    await stores.close();
  }
}

function parseArgs(argv: string[]): CliOptions {
  const flags = new Map<string, string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (arg === "--username" || arg === "--password" || arg === "--role") {
      const value = argv[index + 1];

      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }

      flags.set(arg.slice(2), value);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const username = flags.get("username");
  const password = flags.get("password");
  const role = flags.get("role") ?? "admin";

  if (username === undefined || password === undefined) {
    throw new Error("Usage: pnpm --filter @media-library/backend create-user -- --username NAME --password PASS [--role admin|view]");
  }

  if (role !== "admin" && role !== "view") {
    throw new Error("Role must be either 'admin' or 'view'");
  }

  return { username, password, role };
}

function printHelp(): void {
  console.log("Usage: pnpm --filter @media-library/backend create-user -- --username NAME --password PASS [--role admin|view]");
  console.log("");
  console.log("Creates a user with the selected role. Defaults to admin when --role is omitted.");
  console.log("Set --role view to allow read-only access without admin permissions.");
}

void main();

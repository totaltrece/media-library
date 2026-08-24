import { config } from "./config.js";
import { openSqliteStores } from "./adapters/sqlite/sqlite-library-store.js";
import { CreateAdminUseCase } from "./application/create-admin.js";
import { UsernameConflictError } from "./application/username-conflict-error.js";

interface CliOptions {
  username: string;
  password: string;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const stores = openSqliteStores(config.sqlitePath);

  try {
    const user = new CreateAdminUseCase(stores.authStore).execute(options);
    console.log(`Created admin user: ${user.username}`);
  } catch (error: unknown) {
    if (error instanceof UsernameConflictError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  } finally {
    stores.close();
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

    if (arg === "--username" || arg === "--password") {
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

  if (username === undefined || password === undefined) {
    throw new Error("Usage: pnpm --filter @media-library/backend create-admin -- --username NAME --password PASS");
  }

  return { username, password };
}

function printHelp(): void {
  console.log("Usage: pnpm --filter @media-library/backend create-admin -- --username NAME --password PASS");
  console.log("");
  console.log("Inserts an admin user with a scrypt password hash. Refuses if the username exists.");
  console.log("Does not modify video files or TagSpaces metadata.");
}

void main();

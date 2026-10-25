import { test } from "node:test";

import { openMariadbStores } from "../src/adapters/mariadb/open-mariadb-stores.js";
import { resetMariadbCatalog } from "../src/adapters/mariadb/reset-mariadb-catalog.js";
import { parseDatabaseConfig } from "../src/application/database-config.js";
import { defineAuthStoreContract } from "./auth-store.contract.js";
import { defineLibraryStoreContract } from "./library-store.contract.js";

const mariadbConfig = readMariadbTestConfig();

if (mariadbConfig === null) {
  test("MariaDB store contracts require MEDIA_LIBRARY_MARIADB_TESTS=1 and MARIADB_*", { skip: true }, () => undefined);
} else {
  defineLibraryStoreContract("mariadb", async () => {
    const stores = await openMariadbStores(mariadbConfig);
    await resetMariadbCatalog(stores.pool);
    return stores.libraryStore;
  });

  defineAuthStoreContract("mariadb", async () => {
    const stores = await openMariadbStores(mariadbConfig);
    await resetMariadbCatalog(stores.pool);
    return stores;
  });
}

function readMariadbTestConfig() {
  if (process.env.MEDIA_LIBRARY_MARIADB_TESTS !== "1") {
    return null;
  }

  const config = parseDatabaseConfig({
    DATABASE_ENGINE: "mariadb",
    MARIADB_HOST: process.env.MARIADB_HOST,
    MARIADB_PORT: process.env.MARIADB_PORT,
    MARIADB_DATABASE: process.env.MARIADB_DATABASE,
    MARIADB_USER: process.env.MARIADB_USER,
    MARIADB_PASSWORD: process.env.MARIADB_PASSWORD,
  });

  return config.engine === "mariadb" ? config : null;
}

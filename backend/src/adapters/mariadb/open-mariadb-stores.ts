import type { Pool } from "mysql2/promise";

import type { MariadbDatabaseConfig } from "../../application/database-config.js";
import { MariaDbAuthStore } from "./mariadb-auth-store.js";
import { MariaDbLibraryStore } from "./mariadb-library-store.js";
import { applyMariadbMigrations, createMariadbPool } from "./mariadb-pool.js";

export interface MariaDbStores {
  libraryStore: MariaDbLibraryStore;
  authStore: MariaDbAuthStore;
  pool: Pool;
  close(): Promise<void>;
}

export async function openMariadbStores(config: MariadbDatabaseConfig): Promise<MariaDbStores> {
  const pool = createMariadbPool(config);
  await applyMariadbMigrations(pool);

  return {
    libraryStore: new MariaDbLibraryStore(pool),
    authStore: new MariaDbAuthStore(pool),
    pool,
    close: async () => {
      await pool.end();
    },
  };
}

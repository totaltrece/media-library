import { openMariadbStores } from "../mariadb/open-mariadb-stores.js";
import { openSqliteStores } from "../sqlite/sqlite-library-store.js";
import type { DatabaseConfig } from "../../application/database-config.js";
import type { AuthStore } from "../../ports/auth-store.js";
import type { LibraryStore } from "../../ports/library-store.js";

export interface AppStores {
  libraryStore: LibraryStore;
  authStore: AuthStore;
  close(): Promise<void>;
}

export async function openStores(database: DatabaseConfig): Promise<AppStores> {
  if (database.engine === "sqlite") {
    const stores = openSqliteStores(database.sqlitePath);

    return {
      libraryStore: stores.libraryStore,
      authStore: stores.authStore,
      close: () => stores.close(),
    };
  }

  const stores = await openMariadbStores(database);

  return {
    libraryStore: stores.libraryStore,
    authStore: stores.authStore,
    close: () => stores.close(),
  };
}

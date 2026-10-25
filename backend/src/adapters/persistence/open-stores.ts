import { openMariadbStores } from "../mariadb/open-mariadb-stores.js";
import { MariaDbCatalogBackup } from "../mariadb/mariadb-catalog-backup.js";
import { openSqliteStores } from "../sqlite/sqlite-library-store.js";
import type { DatabaseConfig } from "../../application/database-config.js";
import type { AuthStore } from "../../ports/auth-store.js";
import type { CatalogBackupPort } from "../../ports/catalog-backup.js";
import type { LibraryStore } from "../../ports/library-store.js";
import { UnsupportedCatalogBackup } from "./unsupported-catalog-backup.js";

export interface AppStores {
  libraryStore: LibraryStore;
  authStore: AuthStore;
  catalogBackup: CatalogBackupPort;
  close(): Promise<void>;
}

export async function openStores(database: DatabaseConfig): Promise<AppStores> {
  if (database.engine === "sqlite") {
    const stores = openSqliteStores(database.sqlitePath);

    return {
      libraryStore: stores.libraryStore,
      authStore: stores.authStore,
      catalogBackup: new UnsupportedCatalogBackup(),
      close: () => stores.close(),
    };
  }

  const stores = await openMariadbStores(database);

  return {
    libraryStore: stores.libraryStore,
    authStore: stores.authStore,
    catalogBackup: new MariaDbCatalogBackup(stores.pool),
    close: () => stores.close(),
  };
}

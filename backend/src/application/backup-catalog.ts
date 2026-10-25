import type { CatalogBackupPort, CatalogBackupResult } from "../ports/catalog-backup.js";
import { BackupNotSupportedError } from "./backup-not-supported-error.js";

export class BackupCatalogUseCase {
  constructor(
    private readonly catalogBackup: CatalogBackupPort,
    private readonly sqlitePath: string | undefined,
  ) {}

  async execute(): Promise<CatalogBackupResult> {
    if (this.sqlitePath === undefined || this.sqlitePath.length === 0) {
      throw new BackupNotSupportedError("SQLITE_PATH is required to write a SQLite backup.");
    }

    return this.catalogBackup.backupToSqlite(this.sqlitePath);
  }
}

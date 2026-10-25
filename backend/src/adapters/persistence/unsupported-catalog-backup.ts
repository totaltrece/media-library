import { BackupNotSupportedError } from "../../application/backup-not-supported-error.js";
import type { CatalogBackupPort, CatalogBackupResult } from "../../ports/catalog-backup.js";

export class UnsupportedCatalogBackup implements CatalogBackupPort {
  async backupToSqlite(_sqlitePath: string): Promise<CatalogBackupResult> {
    throw new BackupNotSupportedError();
  }
}

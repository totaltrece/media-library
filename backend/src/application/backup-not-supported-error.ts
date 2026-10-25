export class BackupNotSupportedError extends Error {
  constructor(message = "Backup is only available when the live database is MariaDB and SQLITE_PATH is set.") {
    super(message);
    this.name = "BackupNotSupportedError";
  }
}

export interface CatalogBackupResult {
  sqlitePath: string;
  tagTypes: number;
  tags: number;
  videos: number;
  relations: number;
  users: number;
}

export interface CatalogBackupPort {
  backupToSqlite(sqlitePath: string): Promise<CatalogBackupResult>;
}

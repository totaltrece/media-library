import type { Pool } from "mysql2/promise";

import type { CatalogBackupPort, CatalogBackupResult } from "../../ports/catalog-backup.js";
import { writeSqliteCatalogDump } from "../sqlite/sqlite-catalog-dump.js";
import { readMariadbCatalogDump } from "./mariadb-catalog-dump.js";

export class MariaDbCatalogBackup implements CatalogBackupPort {
  constructor(private readonly pool: Pool) {}

  async backupToSqlite(sqlitePath: string): Promise<CatalogBackupResult> {
    const dump = await readMariadbCatalogDump(this.pool);
    writeSqliteCatalogDump(sqlitePath, dump);

    return {
      sqlitePath,
      tagTypes: dump.tagTypes.length,
      tags: dump.tags.length,
      videos: dump.videos.length,
      relations: dump.videoTags.length,
      users: dump.users.length,
    };
  }
}

import type { Pool } from "mysql2/promise";

import { executeChange } from "./mariadb-sql.js";

export async function resetMariadbCatalog(pool: Pool): Promise<void> {
  await executeChange(pool, "SET FOREIGN_KEY_CHECKS = 0");
  await executeChange(pool, "DELETE FROM video_tags");
  await executeChange(pool, "DELETE FROM tags");
  await executeChange(pool, "DELETE FROM videos");
  await executeChange(pool, "DELETE FROM sessions");
  await executeChange(pool, "DELETE FROM users");
  await executeChange(pool, "DELETE FROM tag_types WHERE id NOT IN (1, 2, 3, 4, 5)");
  await executeChange(pool, "ALTER TABLE tags AUTO_INCREMENT = 1");
  await executeChange(pool, "ALTER TABLE users AUTO_INCREMENT = 1");
  await executeChange(pool, "SET FOREIGN_KEY_CHECKS = 1");
}

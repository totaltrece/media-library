export interface SqliteMigration {
  version: number;
  sql: string;
}

export const sqliteMigrations: SqliteMigration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE videos (
        id TEXT PRIMARY KEY
      ) STRICT;

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      ) STRICT;

      CREATE TABLE video_tags (
        video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        PRIMARY KEY (video_id, tag_id),
        UNIQUE (video_id, position)
      ) STRICT;
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE videos ADD COLUMN recorded_at TEXT;
    `,
  },
];

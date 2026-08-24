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
  {
    version: 3,
    sql: `
      CREATE TABLE tag_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL
      ) STRICT;

      INSERT INTO tag_types (id, name, color, is_default, sort_order) VALUES
        (1, 'type', '#c0392b', 0, 1),
        (2, 'style', '#f1948a', 0, 2),
        (3, 'teacher', '#27ae60', 0, 3),
        (4, 'location', '#8d6e63', 0, 4),
        (5, 'resource', '#93c5fd', 1, 5);

      CREATE TABLE tags_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        tag_type_id INTEGER NOT NULL DEFAULT 5 REFERENCES tag_types(id)
      ) STRICT;

      INSERT INTO tags_new (id, name, tag_type_id)
      SELECT id, name, 5 FROM tags;

      UPDATE tags_new SET tag_type_id = 1 WHERE lower(name) IN ('salsa', 'bachata');
      UPDATE tags_new SET tag_type_id = 2 WHERE lower(name) IN (
        'on2', 'linea', 'rueda', 'dominicana', 'sensual', 'tradicional'
      );
      UPDATE tags_new SET tag_type_id = 3 WHERE lower(name) IN (
        'jota', 'estela', 'gabriela', 'pascual', 'dani', 'isa', 'irene', 'javi'
      );
      UPDATE tags_new SET tag_type_id = 4 WHERE lower(name) IN (
        'host', 'sonando', 'pamplona', 'fdm', 'ermita', 'fdem'
      );

      DROP TABLE tags;
      ALTER TABLE tags_new RENAME TO tags;
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'view')),
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX sessions_user_id ON sessions(user_id);
      CREATE INDEX sessions_expires_at ON sessions(expires_at);
    `,
  },
];

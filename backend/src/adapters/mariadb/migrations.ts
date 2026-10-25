export interface MariadbMigration {
  version: number;
  statements: string[];
}

export const mariadbMigrations: MariadbMigration[] = [
  {
    version: 1,
    statements: [
      `
        CREATE TABLE videos (
          id VARCHAR(255) NOT NULL,
          recorded_at VARCHAR(64) NULL,
          PRIMARY KEY (id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `,
      `
        CREATE TABLE tag_types (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          color VARCHAR(32) NOT NULL,
          is_default TINYINT NOT NULL DEFAULT 0,
          sort_order INT NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY tag_types_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `,
      `
        INSERT INTO tag_types (id, name, color, is_default, sort_order) VALUES
          (1, 'type', '#c0392b', 0, 1),
          (2, 'style', '#f1948a', 0, 2),
          (3, 'teacher', '#27ae60', 0, 3),
          (4, 'location', '#8d6e63', 0, 4),
          (5, 'resource', '#93c5fd', 1, 5)
      `,
      "ALTER TABLE tag_types AUTO_INCREMENT = 6",
      `
        CREATE TABLE tags (
          id INT NOT NULL AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          tag_type_id INT NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY tags_name (name),
          CONSTRAINT fk_tags_type FOREIGN KEY (tag_type_id) REFERENCES tag_types(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `,
      `
        CREATE TABLE video_tags (
          video_id VARCHAR(255) NOT NULL,
          tag_id INT NOT NULL,
          position INT NOT NULL,
          PRIMARY KEY (video_id, tag_id),
          UNIQUE KEY video_tags_position (video_id, position),
          CONSTRAINT fk_video_tags_video FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
          CONSTRAINT fk_video_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `,
      `
        CREATE TABLE users (
          id INT NOT NULL AUTO_INCREMENT,
          username VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role ENUM('admin', 'view') NOT NULL,
          created_at VARCHAR(64) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY users_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `,
      `
        CREATE TABLE sessions (
          token VARCHAR(255) NOT NULL,
          user_id INT NOT NULL,
          created_at VARCHAR(64) NOT NULL,
          expires_at VARCHAR(64) NOT NULL,
          PRIMARY KEY (token),
          KEY sessions_user_id (user_id),
          KEY sessions_expires_at (expires_at),
          CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin
      `,
    ],
  },
];

import type { DatabaseSync } from "node:sqlite";

import type {
  AuthRole,
  AuthSession,
  AuthSessionWithUser,
  AuthStore,
  AuthUser,
  AuthUserRecord,
} from "../../ports/auth-store.js";

export class SqliteAuthStore implements AuthStore {
  constructor(private readonly database: DatabaseSync) {}

  createUser(username: string, passwordHash: string, role: AuthRole): AuthUser {
    const createdAt = new Date().toISOString();

    try {
      this.database
        .prepare(
          `
            INSERT INTO users (username, password_hash, role, created_at)
            VALUES (?, ?, ?, ?)
          `,
        )
        .run(username, passwordHash, role, createdAt);
    } catch (error: unknown) {
      if (isUniqueConstraint(error)) {
        throw new Error(`Username already exists: ${username}`);
      }

      throw error;
    }

    const user = this.findUserByUsername(username);

    if (user === null) {
      throw new Error(`Unable to persist user ${username}`);
    }

    return toAuthUser(user);
  }

  findUserByUsername(username: string): AuthUserRecord | null {
    const row = this.database
      .prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?")
      .get(username);

    return isUserRow(row) ? toAuthUserRecord(row) : null;
  }

  findUserById(id: number): AuthUser | null {
    const row = this.database
      .prepare("SELECT id, username, role FROM users WHERE id = ?")
      .get(id);

    return isPublicUserRow(row) ? toAuthUser(row) : null;
  }

  createSession(userId: number, token: string, expiresAt: Date): AuthSession {
    const createdAt = new Date().toISOString();
    const expiresAtIso = expiresAt.toISOString();

    this.database
      .prepare(
        `
          INSERT INTO sessions (token, user_id, created_at, expires_at)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(token, userId, createdAt, expiresAtIso);

    return {
      token,
      userId,
      createdAt,
      expiresAt: expiresAtIso,
    };
  }

  findValidSession(token: string, now = new Date()): AuthSessionWithUser | null {
    const row = this.database
      .prepare(
        `
          SELECT
            sessions.token AS token,
            sessions.user_id AS userId,
            sessions.created_at AS createdAt,
            sessions.expires_at AS expiresAt,
            users.id AS id,
            users.username AS username,
            users.role AS role
          FROM sessions
          INNER JOIN users ON users.id = sessions.user_id
          WHERE sessions.token = ? AND sessions.expires_at > ?
        `,
      )
      .get(token, now.toISOString());

    return isSessionWithUserRow(row) ? toAuthSessionWithUser(row) : null;
  }

  deleteSession(token: string): void {
    this.database.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  }
}

function toAuthUser(row: { id: number | bigint; username: string; role: AuthRole }): AuthUser {
  return {
    id: Number(row.id),
    username: row.username,
    role: row.role,
  };
}

function toAuthUserRecord(row: UserRow): AuthUserRecord {
  return {
    ...toAuthUser(row),
    passwordHash: row.password_hash,
  };
}

function toAuthSessionWithUser(row: SessionWithUserRow): AuthSessionWithUser {
  return {
    token: row.token,
    userId: Number(row.userId),
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    user: {
      id: Number(row.id),
      username: row.username,
      role: row.role,
    },
  };
}

interface UserRow {
  id: number | bigint;
  username: string;
  password_hash: string;
  role: AuthRole;
}

interface PublicUserRow {
  id: number | bigint;
  username: string;
  role: AuthRole;
}

interface SessionWithUserRow {
  token: string;
  userId: number | bigint;
  createdAt: string;
  expiresAt: string;
  id: number | bigint;
  username: string;
  role: AuthRole;
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === "admin" || value === "view";
}

function isUserRow(value: unknown): value is UserRow {
  return (
    isRecord(value) &&
    isIntegerValue(value.id) &&
    typeof value.username === "string" &&
    typeof value.password_hash === "string" &&
    isAuthRole(value.role)
  );
}

function isPublicUserRow(value: unknown): value is PublicUserRow {
  return (
    isRecord(value) &&
    isIntegerValue(value.id) &&
    typeof value.username === "string" &&
    isAuthRole(value.role)
  );
}

function isSessionWithUserRow(value: unknown): value is SessionWithUserRow {
  return (
    isRecord(value) &&
    typeof value.token === "string" &&
    isIntegerValue(value.userId) &&
    typeof value.createdAt === "string" &&
    typeof value.expiresAt === "string" &&
    isIntegerValue(value.id) &&
    typeof value.username === "string" &&
    isAuthRole(value.role)
  );
}

function isIntegerValue(value: unknown): value is number | bigint {
  return typeof value === "number" || typeof value === "bigint";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Error && /unique/i.test(error.message);
}

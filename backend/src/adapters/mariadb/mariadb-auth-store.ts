import type { Pool } from "mysql2/promise";

import type {
  AuthRole,
  AuthSession,
  AuthSessionWithUser,
  AuthStore,
  AuthUser,
  AuthUserRecord,
} from "../../ports/auth-store.js";
import { executeChange, isUniqueViolation, queryOne, queryRows } from "./mariadb-sql.js";

export class MariaDbAuthStore implements AuthStore {
  constructor(private readonly pool: Pool) {}

  async createUser(username: string, passwordHash: string, role: AuthRole): Promise<AuthUser> {
    const createdAt = new Date().toISOString();

    try {
      await executeChange(
        this.pool,
        `
          INSERT INTO users (username, password_hash, role, created_at)
          VALUES (?, ?, ?, ?)
        `,
        [username, passwordHash, role, createdAt],
      );
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        throw new Error(`Username already exists: ${username}`);
      }

      throw error;
    }

    const user = await this.findUserByUsername(username);

    if (user === null) {
      throw new Error(`Unable to persist user ${username}`);
    }

    return toAuthUser(user);
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    const row = await queryOne(this.pool, "SELECT id, username, password_hash, role FROM users WHERE username = ?", [
      username,
    ]);

    return isUserRow(row) ? toAuthUserRecord(row) : null;
  }

  async findUserById(id: number): Promise<AuthUser | null> {
    const row = await queryOne(this.pool, "SELECT id, username, role FROM users WHERE id = ?", [id]);

    return isPublicUserRow(row) ? toAuthUser(row) : null;
  }

  async listUsers(role?: AuthRole): Promise<AuthUser[]> {
    const rows =
      role === undefined
        ? await queryRows(this.pool, "SELECT id, username, role FROM users ORDER BY username")
        : await queryRows(this.pool, "SELECT id, username, role FROM users WHERE role = ? ORDER BY username", [role]);

    const users: AuthUser[] = [];

    for (const row of rows) {
      if (isPublicUserRow(row)) {
        users.push(toAuthUser(row));
      }
    }

    return users;
  }

  async deleteUser(id: number): Promise<void> {
    const result = await executeChange(this.pool, "DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 0) {
      throw new Error(`User not found: ${id}`);
    }
  }

  async createSession(userId: number, token: string, expiresAt: Date): Promise<AuthSession> {
    const createdAt = new Date().toISOString();
    const expiresAtIso = expiresAt.toISOString();

    await executeChange(
      this.pool,
      `
        INSERT INTO sessions (token, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
      `,
      [token, userId, createdAt, expiresAtIso],
    );

    return {
      token,
      userId,
      createdAt,
      expiresAt: expiresAtIso,
    };
  }

  async findValidSession(token: string, now = new Date()): Promise<AuthSessionWithUser | null> {
    const row = await queryOne(
      this.pool,
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
      [token, now.toISOString()],
    );

    return isSessionWithUserRow(row) ? toAuthSessionWithUser(row) : null;
  }

  async deleteSession(token: string): Promise<void> {
    await executeChange(this.pool, "DELETE FROM sessions WHERE token = ?", [token]);
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
    isRecord(value) && isIntegerValue(value.id) && typeof value.username === "string" && isAuthRole(value.role)
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

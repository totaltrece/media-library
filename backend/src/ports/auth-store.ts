export type AuthRole = "admin" | "view";

export interface AuthUser {
  id: number;
  username: string;
  role: AuthRole;
}

export interface AuthUserRecord extends AuthUser {
  passwordHash: string;
}

export interface AuthSession {
  token: string;
  userId: number;
  createdAt: string;
  expiresAt: string;
}

export interface AuthSessionWithUser extends AuthSession {
  user: AuthUser;
}

export interface AuthStore {
  createUser(username: string, passwordHash: string, role: AuthRole): AuthUser;
  findUserByUsername(username: string): AuthUserRecord | null;
  findUserById(id: number): AuthUser | null;
  createSession(userId: number, token: string, expiresAt: Date): AuthSession;
  findValidSession(token: string, now?: Date): AuthSessionWithUser | null;
  deleteSession(token: string): void;
}

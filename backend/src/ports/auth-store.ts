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
  createUser(username: string, passwordHash: string, role: AuthRole): Promise<AuthUser>;
  findUserByUsername(username: string): Promise<AuthUserRecord | null>;
  findUserById(id: number): Promise<AuthUser | null>;
  createSession(userId: number, token: string, expiresAt: Date): Promise<AuthSession>;
  findValidSession(token: string, now?: Date): Promise<AuthSessionWithUser | null>;
  deleteSession(token: string): Promise<void>;
}

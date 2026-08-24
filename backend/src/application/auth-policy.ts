import type { AuthRole, AuthUser } from "../ports/auth-store.js";

export type AuthPrincipal = Pick<AuthUser, "username" | "role">;

export function canRead(principal: AuthPrincipal | null, publicRead: boolean): boolean {
  if (publicRead) {
    return true;
  }

  return principal !== null && isReadRole(principal.role);
}

export function canWrite(principal: AuthPrincipal | null): boolean {
  return principal?.role === "admin";
}

export function isAuthExemptPath(method: string, path: string): boolean {
  const normalized = stripQuery(path);

  if (method === "POST" && (normalized.endsWith("/auth/login") || normalized.endsWith("/auth/logout"))) {
    return true;
  }

  return method === "GET" && normalized.endsWith("/auth/me");
}

export function authorizeRequest(options: {
  method: string;
  path: string;
  principal: AuthPrincipal | null;
  publicRead: boolean;
}): { ok: true } | { ok: false; status: 401 | 403; message: string } {
  if (isAuthExemptPath(options.method, options.path)) {
    return { ok: true };
  }

  if (isReadMethod(options.method)) {
    if (canRead(options.principal, options.publicRead)) {
      return { ok: true };
    }

    return unauthorized();
  }

  if (canWrite(options.principal)) {
    return { ok: true };
  }

  if (options.principal === null) {
    return unauthorized();
  }

  return {
    ok: false,
    status: 403,
    message: "Admin access required",
  };
}

function isReadRole(role: AuthRole): boolean {
  return role === "admin" || role === "view";
}

function isReadMethod(method: string): boolean {
  return method === "GET" || method === "HEAD" || method === "OPTIONS";
}

function stripQuery(path: string): string {
  const queryIndex = path.indexOf("?");
  return queryIndex === -1 ? path : path.slice(0, queryIndex);
}

function unauthorized(): { ok: false; status: 401; message: string } {
  return {
    ok: false,
    status: 401,
    message: "Authentication required",
  };
}

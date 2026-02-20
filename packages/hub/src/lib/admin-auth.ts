import { resolveGithubOAuthSession } from "./github-oauth-session";

const DEFAULT_ADMIN_LOGIN = "QingJ01";
export const ADMIN_CSRF_COOKIE = "r2r_admin_csrf";

export function readCookie(request: Request, key: string): string | undefined {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return undefined;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === key) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return undefined;
}

export function createCsrfToken(): string {
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function csrfCookieHeader(token: string): string {
  return `${ADMIN_CSRF_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Strict`;
}

export function resolveCsrfCookieToken(request: Request): string | undefined {
  return readCookie(request, ADMIN_CSRF_COOKIE);
}

export function resolveCsrfHeaderToken(request: Request): string | undefined {
  return request.headers.get("x-csrf-token") ?? undefined;
}

export function validateAdminCsrf(request: Request): boolean {
  const cookieToken = resolveCsrfCookieToken(request);
  const headerToken = resolveCsrfHeaderToken(request);
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

export function resolveAdminLogin(): string {
  return process.env.R2R_ADMIN_GITHUB_LOGIN ?? DEFAULT_ADMIN_LOGIN;
}

export function isAdminActor(actorId: string): boolean {
  return actorId.toLowerCase() === resolveAdminLogin().toLowerCase();
}

export async function resolveSessionActor(request: Request): Promise<string | undefined> {
  const sessionToken =
    request.headers.get("x-session-token") ??
    readCookie(request, "r2r_session") ??
    undefined;

  if (!sessionToken) {
    return undefined;
  }

  const session = await resolveGithubOAuthSession(sessionToken);
  return session?.actorId;
}

export async function requireAdminActor(request: Request): Promise<{ ok: true; actorId: string } | { ok: false; status: number; message: string }> {
  const actorId = await resolveSessionActor(request);
  if (!actorId) {
    return { ok: false, status: 401, message: "admin session required" };
  }

  if (!isAdminActor(actorId)) {
    return { ok: false, status: 403, message: "forbidden" };
  }

  return { ok: true, actorId };
}

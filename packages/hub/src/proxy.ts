// Next.js proxy entry — always runs on Node.js runtime automatically.
// Do NOT add `export const runtime` here; Next.js 16 forbids it in proxy files.
import { isAdminActor, readCookie } from "./lib/admin-auth";
import { resolveGithubOAuthSession } from "./lib/github-oauth-session";

function buildLoginRedirect(url: URL): Response {
  const loginUrl = new URL("/api/auth/github", url.origin);
  loginUrl.searchParams.set("action", "login");
  loginUrl.searchParams.set("redirect", "/admin");
  return Response.redirect(loginUrl, 302);
}

// Stale / invalid session: clear the bad cookie via the logout endpoint so the
// browser doesn't keep replaying it and landing in a redirect loop.
function buildStaleCookieRedirect(url: URL): Response {
  const logoutUrl = new URL("/api/auth/github", url.origin);
  logoutUrl.searchParams.set("action", "logout");
  logoutUrl.searchParams.set("redirect", "/auth");
  return Response.redirect(logoutUrl, 302);
}

function buildAuthFallbackRedirect(url: URL): Response {
  const authUrl = new URL("/auth", url.origin);
  return Response.redirect(authUrl, 302);
}

function buildForbiddenRedirect(url: URL): Response {
  const location = new URL("/auth", url.origin);
  location.searchParams.set("forbidden", "admin");
  return Response.redirect(location, 302);
}

export async function resolveAdminGateDecision(
  request: Request
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/admin")) {
    return undefined;
  }

  const sessionToken = readCookie(request, "r2r_session");
  if (!sessionToken) {
    // No cookie at all → send to GitHub login
    return buildLoginRedirect(url);
  }

  try {
    const session = await resolveGithubOAuthSession(sessionToken);
    if (!session) {
      // Cookie present but not recognised (expired / deleted from store) →
      // clear it first, then let the user log in fresh.
      return buildStaleCookieRedirect(url);
    }

    if (!isAdminActor(session.actorId)) {
      return buildForbiddenRedirect(url);
    }

    return undefined;
  } catch {
    // Store errors (e.g. DB outage) should not clear valid cookies.
    return buildAuthFallbackRedirect(url);
  }
}

export async function proxy(request: Request): Promise<Response | undefined> {
  return resolveAdminGateDecision(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

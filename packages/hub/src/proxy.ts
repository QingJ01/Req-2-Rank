import { isAdminActor } from "./lib/admin-auth";

const LANG_COOKIE = "hub.lang";

function readCookie(request: Request, key: string): string | undefined {
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

function buildLoginRedirect(url: URL, request: Request): Response {
  const langParam = url.searchParams.get("lang");
  const langCookie = readCookie(request, LANG_COOKIE);
  const lang = langParam ?? (langCookie === "en" ? "en" : "zh");
  const backTo = `/admin?lang=${encodeURIComponent(lang)}`;
  const loginUrl = new URL("/api/auth/github", url.origin);
  loginUrl.searchParams.set("action", "login");
  loginUrl.searchParams.set("redirect", backTo);
  return Response.redirect(loginUrl, 302);
}

function buildForbiddenRedirect(url: URL): Response {
  const location = new URL("/auth", url.origin);
  location.searchParams.set("forbidden", "admin");
  const lang = url.searchParams.get("lang") ?? "zh";
  location.searchParams.set("lang", lang === "en" ? "en" : "zh");
  return Response.redirect(location, 302);
}

export async function resolveAdminGateDecision(
  request: Request,
  fetchImpl: typeof fetch = fetch
): Promise<Response | undefined> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/admin")) {
    return undefined;
  }

  const sessionToken = readCookie(request, "r2r_session");
  if (!sessionToken) {
    return buildLoginRedirect(url, request);
  }

  const verifyUrl = new URL("/api/auth/github", url.origin);
  verifyUrl.searchParams.set("action", "session");
  verifyUrl.searchParams.set("session", sessionToken);

  try {
    const response = await fetchImpl(verifyUrl.toString(), {
      headers: {
        "x-session-token": sessionToken
      },
      cache: "no-store"
    });

    if (!response.ok) {
      return buildLoginRedirect(url, request);
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      data?: {
        actorId?: string;
      };
    };

    const actorId = payload.data?.actorId;
    if (!payload.ok || !actorId) {
      return buildLoginRedirect(url, request);
    }

    if (!isAdminActor(actorId)) {
      return buildForbiddenRedirect(url);
    }

    return undefined;
  } catch {
    return buildLoginRedirect(url, request);
  }
}

export async function proxy(request: Request): Promise<Response | undefined> {
  return resolveAdminGateDecision(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};

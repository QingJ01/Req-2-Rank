import { RouteEnvelope } from "../../../../routes";
import { defaultConfig, Req2RankConfig } from "@req2rank/core";
import {
  consumeGithubOAuthState,
  gcGithubOAuthSessionStore,
  issueGithubOAuthSession,
  issueGithubOAuthState,
  resolveGithubOAuthSession
} from "../../../../lib/github-oauth-session";
import { isAdminActor, readCookie } from "../../../../lib/admin-auth";

export interface GithubAuthCallbackInput {
  code: string;
  state?: string;
  actorIdHint?: string;
}

export interface GithubAuthSession {
  provider: "github";
  actorId: string;
  accessToken: string;
  sessionToken: string;
  issuedAt: string;
}

export interface GithubLoginState {
  state: string;
  authUrl: string;
}

export async function startGithubAuthLogin(input: {
  actorIdHint?: string;
  redirectUri?: string;
}): Promise<RouteEnvelope<GithubLoginState>> {
  try {
    const clientId = process.env.R2R_GITHUB_CLIENT_ID;
    requireNonEmpty(clientId ?? "", "R2R_GITHUB_CLIENT_ID");

    const redirectUri = input.redirectUri ?? process.env.R2R_GITHUB_REDIRECT_URI ?? "http://localhost:3000/api/auth/github";
    const state = await issueGithubOAuthState({ actorIdHint: input.actorIdHint });

    const params = new URLSearchParams({
      client_id: clientId as string,
      redirect_uri: redirectUri,
      scope: "read:user",
      state
    });

    return {
      ok: true,
      status: 200,
      data: {
        state,
        authUrl: `https://github.com/login/oauth/authorize?${params.toString()}`
      }
    };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Invalid request"
      }
    };
  }
}

interface GithubTokenResponse {
  access_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GithubUserResponse {
  id: number;
  login: string;
}

function shouldUseSecureCookies(): boolean {
  return process.env.R2R_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

function sessionCookieHeader(token: string, maxAge?: number): string {
  const segments = [`r2r_session=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (typeof maxAge === "number") {
    segments.push(`Max-Age=${maxAge}`);
  }
  if (shouldUseSecureCookies()) {
    segments.push("Secure");
  }
  return segments.join("; ");
}

function buildCliConfig(serverUrl: string, token: string): string {
  const config = JSON.parse(JSON.stringify(defaultConfig)) as Req2RankConfig;
  config.hub = {
    enabled: true,
    serverUrl,
    token
  };
  return JSON.stringify(config, null, 2);
}

function requireNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

export async function handleGithubAuthCallback(
  input: GithubAuthCallbackInput
): Promise<RouteEnvelope<GithubAuthSession>> {
  try {
    requireNonEmpty(input.code, "code");
    const clientId = process.env.R2R_GITHUB_CLIENT_ID;
    const clientSecret = process.env.R2R_GITHUB_CLIENT_SECRET;
    requireNonEmpty(clientId ?? "", "R2R_GITHUB_CLIENT_ID");
    requireNonEmpty(clientSecret ?? "", "R2R_GITHUB_CLIENT_SECRET");

    const oauthClientId = clientId as string;
    const oauthClientSecret = clientSecret as string;

    const params = new URLSearchParams({
      client_id: oauthClientId,
      client_secret: oauthClientSecret,
      code: input.code
    });
    if (input.state) {
      params.set("state", input.state);
    }

    const pending = input.state ? await consumeGithubOAuthState(input.state) : undefined;

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params
    });

    if (!tokenResponse.ok) {
      throw new Error(`GitHub token exchange failed: ${tokenResponse.status}`);
    }

    const tokenPayload = (await tokenResponse.json()) as GithubTokenResponse;
    const accessToken = tokenPayload.access_token;
    requireNonEmpty(accessToken ?? "", "GitHub access token");
    const oauthAccessToken = accessToken as string;

    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${oauthAccessToken}`,
        Accept: "application/json",
        "User-Agent": "req2rank-hub"
      }
    });
    if (!userResponse.ok) {
      throw new Error(`GitHub user fetch failed: ${userResponse.status}`);
    }

    const userPayload = (await userResponse.json()) as GithubUserResponse;
    const actorId = input.actorIdHint?.trim() || pending?.actorIdHint || userPayload.login || String(userPayload.id);
    const sessionToken = await issueGithubOAuthSession({
      actorId,
      accessToken: oauthAccessToken
    });

    return {
      ok: true,
      status: 200,
      data: {
        provider: "github",
        actorId,
        accessToken: oauthAccessToken,
        sessionToken,
        issuedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      ok: false,
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : "Invalid request"
      }
    };
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? (url.searchParams.get("code") ? "callback" : "session");

  if (action === "logout") {
    const redirect = url.searchParams.get("redirect") ?? "/auth";
    const location = new URL(redirect, url.origin);
    if (!location.searchParams.has("lang")) {
      location.searchParams.set("lang", "zh");
    }

    const headers = new Headers();
    headers.set("location", location.toString());
    headers.set("set-cookie", sessionCookieHeader("", 0));
    return new Response(null, { status: 302, headers });
  }

  if (action === "login") {
    const responseFormat = url.searchParams.get("format") ?? "redirect";
    const redirect = url.searchParams.get("redirect") ?? undefined;
    const explicitRedirectUri = url.searchParams.get("redirect_uri") ?? undefined;
    const baseRedirectUri = explicitRedirectUri ?? process.env.R2R_GITHUB_REDIRECT_URI ?? "http://localhost:3000/api/auth/github";
    const loginRedirectUri = redirect
      ? `${baseRedirectUri}${baseRedirectUri.includes("?") ? "&" : "?"}redirect=${encodeURIComponent(redirect)}`
      : baseRedirectUri;

    const login = await startGithubAuthLogin({
      actorIdHint: url.searchParams.get("actor") ?? undefined,
      redirectUri: loginRedirectUri
    });
    if (responseFormat === "json") {
      return Response.json(login, { status: login.status });
    }
    if (!login.ok) {
      return Response.json(login, { status: login.status });
    }
    return new Response(null, {
      status: 302,
      headers: {
        location: login.data.authUrl
      }
    });
  }

  if (action === "session") {
    await gcGithubOAuthSessionStore();
    const sessionToken =
      request.headers.get("x-session-token") ??
      url.searchParams.get("session") ??
      readCookie(request, "r2r_session") ??
      "";
    const session = await resolveGithubOAuthSession(sessionToken);
    if (!session) {
      return Response.json(
        {
          ok: false,
          status: 401,
          error: {
            code: "AUTH_ERROR",
            message: "session not found"
          }
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        ok: true,
        status: 200,
        data: {
          actorId: session.actorId
        }
      },
      { status: 200 }
    );
  }

  if (action === "cli-config") {
    await gcGithubOAuthSessionStore();
    const sessionToken = request.headers.get("x-session-token") ?? readCookie(request, "r2r_session") ?? "";
    const session = await resolveGithubOAuthSession(sessionToken);
    if (!session) {
      return Response.json(
        {
          ok: false,
          status: 401,
          error: {
            code: "AUTH_ERROR",
            message: "session not found"
          }
        },
        { status: 401 }
      );
    }

    const cliConfig = buildCliConfig(url.origin, sessionToken);
    return new Response(cliConfig, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": 'attachment; filename="req2rank.config.json"',
        "cache-control": "no-store"
      }
    });
  }

  const result = await handleGithubAuthCallback({
    code: url.searchParams.get("code") ?? "",
    state: url.searchParams.get("state") ?? undefined,
    actorIdHint: url.searchParams.get("actor") ?? undefined
  });

  if (!result.ok) {
    const fallback = new URL("/auth", url.origin);
    fallback.searchParams.set("error", result.error.message);
    if (!fallback.searchParams.has("lang")) {
      fallback.searchParams.set("lang", "zh");
    }
    return new Response(null, {
      status: 302,
      headers: {
        location: fallback.toString()
      }
    });
  }

  const requestedRedirect = url.searchParams.get("redirect") ?? "/auth";
  let safeRedirectPath = "/auth";
  try {
    const requestedLocation = new URL(requestedRedirect, url.origin);
    if (requestedLocation.origin === url.origin) {
      const isAdminPath = requestedLocation.pathname.startsWith("/admin");
      if (!isAdminPath || isAdminActor(result.data.actorId)) {
        safeRedirectPath = `${requestedLocation.pathname}${requestedLocation.search}${requestedLocation.hash}`;
      }
    }
  } catch {
    safeRedirectPath = "/auth";
  }

  const location = new URL(safeRedirectPath, url.origin);
  if (!location.searchParams.has("lang")) {
    location.searchParams.set("lang", "zh");
  }

  const headers = new Headers();
  headers.set("location", location.toString());
  headers.set("set-cookie", sessionCookieHeader(result.data.sessionToken));
  return new Response(null, { status: 302, headers });
}

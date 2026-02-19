import { RouteEnvelope } from "../../../../routes.js";
import {
  consumeGithubOAuthState,
  gcGithubOAuthSessionStore,
  issueGithubOAuthSession,
  issueGithubOAuthState,
  resolveGithubOAuthSession
} from "../../../../lib/github-oauth-session.js";

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
    const state = issueGithubOAuthState({ actorIdHint: input.actorIdHint });

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

    const pending = input.state ? consumeGithubOAuthState(input.state) : undefined;

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
    const sessionToken = issueGithubOAuthSession({
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

  if (action === "login") {
    const login = await startGithubAuthLogin({
      actorIdHint: url.searchParams.get("actor") ?? undefined,
      redirectUri: url.searchParams.get("redirect_uri") ?? undefined
    });
    return Response.json(login, { status: login.status });
  }

  if (action === "session") {
    gcGithubOAuthSessionStore();
    const sessionToken = request.headers.get("x-session-token") ?? url.searchParams.get("session") ?? "";
    const session = resolveGithubOAuthSession(sessionToken);
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

  const result = await handleGithubAuthCallback({
    code: url.searchParams.get("code") ?? "",
    state: url.searchParams.get("state") ?? undefined,
    actorIdHint: url.searchParams.get("actor") ?? undefined
  });

  const headers = new Headers();
  if (result.ok) {
    headers.set("set-cookie", `r2r_session=${result.data.sessionToken}; Path=/; HttpOnly; SameSite=Lax`);
  }

  return new Response(JSON.stringify(result), {
    status: result.status,
    headers: {
      "content-type": "application/json",
      ...Object.fromEntries(headers.entries())
    }
  });
}

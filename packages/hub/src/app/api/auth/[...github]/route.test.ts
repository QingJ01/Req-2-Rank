import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, handleGithubAuthCallback, startGithubAuthLogin } from "./route.js";
import { issueGithubOAuthSession } from "../../../../lib/github-oauth-session.js";

describe("github auth callback route", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalCookieSecure = process.env.R2R_COOKIE_SECURE;

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.R2R_GITHUB_CLIENT_ID;
    delete process.env.R2R_GITHUB_CLIENT_SECRET;
    env.NODE_ENV = originalNodeEnv;
    env.R2R_COOKIE_SECURE = originalCookieSecure;
  });

  it("exchanges code with GitHub and returns normalized session payload", async () => {
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";
    process.env.R2R_GITHUB_CLIENT_SECRET = "client-secret-1";

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("github.com/login/oauth/access_token")) {
        return new Response(JSON.stringify({ access_token: "gho_real_token", token_type: "bearer" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (url.includes("api.github.com/user")) {
        return new Response(JSON.stringify({ id: 123, login: "user-1" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response("not-found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await handleGithubAuthCallback({
      code: "oauth-code-1",
      state: undefined,
      actorIdHint: "user-1"
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected auth success");
    }
    expect(result.data.provider).toBe("github");
    expect(result.data.accessToken).toBe("gho_real_token");
  });

  it("returns validation error when GitHub OAuth credentials are missing", async () => {
    const result = await handleGithubAuthCallback({
      code: "oauth-code-1",
      state: "state-1",
      actorIdHint: "user-1"
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth failure");
    }
    expect(result.error.message).toContain("R2R_GITHUB_CLIENT_ID");
  });

  it("supports HTTP callback handler with redirect", async () => {
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";
    process.env.R2R_GITHUB_CLIENT_SECRET = "client-secret-1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "gho_real_token_http", token_type: "bearer" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ id: 123, login: "github-user" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const response = await GET(new Request("http://localhost/api/auth/github?code=oauth-code-2"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth");
    expect(response.headers.get("set-cookie")).toContain("r2r_session=");
  });

  it("falls back to /auth when non-admin callback asks for /admin", async () => {
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";
    process.env.R2R_GITHUB_CLIENT_SECRET = "client-secret-1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "gho_user_token", token_type: "bearer" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ id: 456, login: "normal-user" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const response = await GET(new Request("http://localhost/api/auth/github?code=oauth-code-4&redirect=%2Fadmin%3Flang%3Dzh"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth");
  });

  it("supports logout action and clears session cookie", async () => {
    const response = await GET(new Request("http://localhost/api/auth/github?action=logout&redirect=/auth"));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/auth");
    expect(response.headers.get("set-cookie")).toContain("r2r_session=");
  });

  it("sets Secure on auth cookies when secure cookies are enabled", async () => {
    process.env.R2R_COOKIE_SECURE = "true";
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";
    process.env.R2R_GITHUB_CLIENT_SECRET = "client-secret-1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "gho_real_token_http", token_type: "bearer" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ id: 123, login: "github-user" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const callbackResponse = await GET(new Request("http://localhost/api/auth/github?code=oauth-code-secure"));
    expect(callbackResponse.headers.get("set-cookie")).toContain("Secure");

    const logoutResponse = await GET(new Request("http://localhost/api/auth/github?action=logout&redirect=/auth"));
    expect(logoutResponse.headers.get("set-cookie")).toContain("Secure");
  });

  it("creates login state and validates callback state", async () => {
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";
    process.env.R2R_GITHUB_CLIENT_SECRET = "client-secret-1";

    const login = await startGithubAuthLogin({
      actorIdHint: "user-1",
      redirectUri: "https://example.com/api/auth/github"
    });
    expect(login.ok).toBe(true);
    if (!login.ok) {
      throw new Error("expected login success");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "gho_real_token_http", token_type: "bearer" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ id: 123, login: "user-1" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      })
    );

    const callback = await handleGithubAuthCallback({
      code: "oauth-code-3",
      state: login.data.state,
      actorIdHint: "user-1"
    });
    expect(callback.ok).toBe(true);

    const badCallback = await handleGithubAuthCallback({
      code: "oauth-code-3",
      state: "wrong-state",
      actorIdHint: "user-1"
    });
    expect(badCallback.ok).toBe(false);
  });

  it("redirects browser login requests to GitHub auth url", async () => {
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";

    const response = await GET(new Request("http://localhost/api/auth/github?action=login&redirect=/auth"));
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("https://github.com/login/oauth/authorize?");
    expect(location).toContain("redirect%3D%252Fauth");
  });

  it("keeps JSON mode for programmatic login url fetch", async () => {
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";

    const response = await GET(new Request("http://localhost/api/auth/github?action=login&format=json"));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok?: boolean; data?: { authUrl?: string } };
    expect(payload.ok).toBe(true);
    expect(payload.data?.authUrl).toContain("https://github.com/login/oauth/authorize?");
  });

  it("reads session token from cookie for session action", async () => {
    const sessionToken = await issueGithubOAuthSession({
      actorId: "cookie-user",
      accessToken: "gho_cookie"
    });

    const response = await GET(
      new Request("http://localhost/api/auth/github?action=session", {
        headers: {
          cookie: `r2r_session=${sessionToken}`
        }
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok?: boolean; data?: { actorId?: string } };
    expect(payload.ok).toBe(true);
    expect(payload.data?.actorId).toBe("cookie-user");
  });

  it("returns 401 for cli-config when session is missing", async () => {
    const response = await GET(new Request("http://localhost/api/auth/github?action=cli-config"));
    expect(response.status).toBe(401);
  });

  it("downloads req2rank.config.json with hub token after login", async () => {
    const sessionToken = await issueGithubOAuthSession({
      actorId: "user-download",
      accessToken: "gho_for_download"
    });

    const response = await GET(
      new Request("http://localhost/api/auth/github?action=cli-config", {
        headers: {
          cookie: `r2r_session=${sessionToken}`
        }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("req2rank.config.json");

    const body = JSON.parse(await response.text()) as {
      hub?: { enabled?: boolean; serverUrl?: string; token?: string };
    };
    expect(body.hub?.enabled).toBe(true);
    expect(body.hub?.serverUrl).toBe("http://localhost");
    expect(body.hub?.token).toBe(sessionToken);
  });
});

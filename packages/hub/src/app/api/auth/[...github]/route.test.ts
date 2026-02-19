import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, handleGithubAuthCallback, startGithubAuthLogin } from "./route.js";

describe("github auth callback route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.R2R_GITHUB_CLIENT_ID;
    delete process.env.R2R_GITHUB_CLIENT_SECRET;
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

  it("supports HTTP callback handler", async () => {
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
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: boolean; data: { provider: string } };
    expect(payload.ok).toBe(true);
    expect(payload.data.provider).toBe("github");
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
});

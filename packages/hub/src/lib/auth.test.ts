import { afterEach, describe, expect, it, vi } from "vitest";
import { handleGithubAuthCallback, startGithubAuthLogin } from "../app/api/auth/[...github]/route.js";
import { createEnvAuthValidator, createGitHubAuthValidator, parseBearerToken } from "./auth.js";

describe("hub auth helpers", () => {
  const env = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.R2R_GITHUB_OAUTH;
    delete process.env.R2R_GITHUB_CLIENT_ID;
    delete process.env.R2R_GITHUB_CLIENT_SECRET;
    delete process.env.R2R_HUB_TOKEN;
    env.NODE_ENV = originalNodeEnv;
  });

  it("parses bearer token", () => {
    expect(parseBearerToken({ authorization: "Bearer token-1" })).toBe("token-1");
    expect(parseBearerToken({ authorization: "Basic token-1" })).toBeUndefined();
  });

  it("validates github oauth token and actor match", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 123, login: "user-1" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const validate = createGitHubAuthValidator(fetch);
    await expect(validate("user-1", "gho_token")).resolves.toBeUndefined();
  });

  it("rejects github oauth token when actor mismatches", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 123, login: "user-1" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const validate = createGitHubAuthValidator(fetch);
    await expect(validate("other-user", "gho_token")).rejects.toThrow("not authorized");
  });

  it("validates oauth session token from github callback", async () => {
    process.env.R2R_GITHUB_OAUTH = "true";
    process.env.R2R_GITHUB_CLIENT_ID = "client-id-1";
    process.env.R2R_GITHUB_CLIENT_SECRET = "client-secret-1";

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("github.com/login/oauth/access_token")) {
          return new Response(JSON.stringify({ access_token: "gho_token", token_type: "bearer" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        const headerRecord = (init?.headers ?? {}) as Record<string, string>;
        const authHeader = headerRecord.Authorization ?? headerRecord.authorization ?? "";
        if (authHeader === "Bearer gho_token") {
          return new Response(JSON.stringify({ id: 123, login: "user-1" }), {
            status: 200,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ message: "bad credentials" }), { status: 401 });
      })
    );

    const login = await startGithubAuthLogin({ actorIdHint: "user-1" });
    if (!login.ok) {
      throw new Error("expected oauth login state");
    }

    const callback = await handleGithubAuthCallback({
      code: "oauth-code",
      state: login.data.state,
      actorIdHint: "user-1"
    });
    if (!callback.ok) {
      throw new Error("expected oauth callback success");
    }

    const validate = createEnvAuthValidator();
    await expect(validate("user-1", callback.data.sessionToken)).resolves.toBeUndefined();
    await expect(validate("other-user", callback.data.sessionToken)).rejects.toThrow("not authorized");
  });

  it("requires hub token in production when oauth is disabled", () => {
    env.NODE_ENV = "production";
    delete process.env.R2R_HUB_TOKEN;
    expect(() => createEnvAuthValidator()).toThrow("R2R_HUB_TOKEN is required when OAuth is disabled in production");
  });
});

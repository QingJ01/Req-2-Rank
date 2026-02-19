import { afterEach, describe, expect, it, vi } from "vitest";
import { createGitHubAuthValidator, parseBearerToken } from "./auth.js";

describe("hub auth helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
});

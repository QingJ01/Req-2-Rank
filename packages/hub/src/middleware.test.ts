import { describe, expect, it } from "vitest";
import { proxy, resolveAdminGateDecision } from "./proxy.js";
import { issueGithubOAuthSession } from "./lib/github-oauth-session.js";

describe("admin middleware gate", () => {
  it("does not redirect non-admin routes", async () => {
    const decision = await proxy(new Request("http://localhost/"));
    expect(decision).toBeUndefined();
  });

  it("redirects to login when session cookie is missing", async () => {
    const decision = await resolveAdminGateDecision(new Request("http://localhost/admin"));
    expect(decision?.status).toBe(302);
    const loc = decision?.headers.get("location") ?? "";
    expect(loc).toContain("/api/auth/github");
    expect(loc).toContain("action=login");
  });

  it("allows valid QingJ01 session through to /admin", async () => {
    const token = await issueGithubOAuthSession({ actorId: "QingJ01", accessToken: "gho_test" });

    const decision = await resolveAdminGateDecision(
      new Request("http://localhost/admin", {
        headers: { cookie: `r2r_session=${token}` }
      })
    );

    expect(decision).toBeUndefined();
  });

  it("redirects non-admin user to forbidden notice", async () => {
    const token = await issueGithubOAuthSession({ actorId: "someone-else", accessToken: "gho_test2" });

    const decision = await resolveAdminGateDecision(
      new Request("http://localhost/admin", {
        headers: { cookie: `r2r_session=${token}` }
      })
    );

    expect(decision?.status).toBe(302);
    expect(decision?.headers.get("location")).toContain("/auth?forbidden=admin");
  });

  it("clears stale cookie via logout redirect instead of looping back to login", async () => {
    // A token that was never issued — simulates an expired/deleted session
    const staleCookie = "r2r_session_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

    const decision = await resolveAdminGateDecision(
      new Request("http://localhost/admin", {
        headers: { cookie: `r2r_session=${staleCookie}` }
      })
    );

    expect(decision?.status).toBe(302);
    const loc = decision?.headers.get("location") ?? "";
    // Must go through logout to clear the bad cookie, NOT back to /admin
    expect(loc).toContain("action=logout");
    expect(loc).toContain("redirect=%2Fauth");
    expect(loc).not.toContain("/admin");
  });

  it("falls back to /auth on session store errors without forcing logout", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalDatabaseUrl = process.env.R2R_DATABASE_URL;

    process.env.NODE_ENV = "production";
    delete process.env.R2R_DATABASE_URL;

    try {
      const decision = await resolveAdminGateDecision(
        new Request("http://localhost/admin", {
          headers: { cookie: "r2r_session=maybe-valid-token" }
        })
      );

      expect(decision?.status).toBe(302);
      const loc = decision?.headers.get("location") ?? "";
      expect(loc).toBe("http://localhost/auth");
      expect(loc).not.toContain("action=logout");
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.R2R_DATABASE_URL = originalDatabaseUrl;
    }
  });
});

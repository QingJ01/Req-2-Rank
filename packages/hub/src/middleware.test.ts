import { describe, expect, it, vi } from "vitest";
import { resolveAdminGateDecision } from "./middleware.js";

describe("admin middleware gate", () => {
  it("redirects to login when session cookie is missing", async () => {
    const decision = await resolveAdminGateDecision(new Request("http://localhost/admin"), vi.fn());
    expect(decision?.status).toBe(302);
    expect(decision?.headers.get("location")).toContain("/api/auth/github?action=login");
  });

  it("allows QingJ01 session for /admin", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, data: { actorId: "QingJ01" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const decision = await resolveAdminGateDecision(
      new Request("http://localhost/admin?lang=en", {
        headers: {
          cookie: "r2r_session=test-session"
        }
      }),
      fetchMock
    );

    expect(decision).toBeUndefined();
  });

  it("redirects non-admin user to login", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, data: { actorId: "someone-else" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );

    const decision = await resolveAdminGateDecision(
      new Request("http://localhost/admin", {
        headers: {
          cookie: "r2r_session=test-session"
        }
      }),
      fetchMock
    );

    expect(decision?.status).toBe(302);
    expect(decision?.headers.get("location")).toContain("/api/auth/github?action=login");
  });
});

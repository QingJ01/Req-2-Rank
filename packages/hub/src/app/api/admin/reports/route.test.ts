import { describe, expect, it } from "vitest";
import { issueGithubOAuthSession } from "../../../../lib/github-oauth-session.js";
import { submitCommunityReport } from "../../../../report-store.js";
import { GET as getAdminReports } from "./route.js";
import { POST as resolveAdminReport } from "./resolve/route.js";

describe("admin report routes", () => {
  it("rejects missing session for admin report listing", async () => {
    const response = await getAdminReports(new Request("http://localhost/api/admin/reports"));
    expect(response.status).toBe(401);
  });

  it("rejects non-admin github account", async () => {
    const sessionToken = await issueGithubOAuthSession({ actorId: "someone-else", accessToken: "gho_x" });
    const response = await getAdminReports(
      new Request("http://localhost/api/admin/reports", {
        headers: {
          cookie: `r2r_session=${sessionToken}`
        }
      })
    );

    expect(response.status).toBe(403);
  });

  it("allows QingJ01 and resolves reports", async () => {
    const report = await submitCommunityReport({ runId: "run-admin-1", reason: "needs review" });
    const sessionToken = await issueGithubOAuthSession({ actorId: "QingJ01", accessToken: "gho_admin" });

    const listResponse = await getAdminReports(
      new Request("http://localhost/api/admin/reports", {
        headers: {
          cookie: `r2r_session=${sessionToken}`
        }
      })
    );
    expect(listResponse.status).toBe(200);
    const listPayload = (await listResponse.json()) as {
      ok: boolean;
      meta?: { csrfToken?: string };
    };
    expect(listPayload.ok).toBe(true);
    const csrfToken = listPayload.meta?.csrfToken;
    expect(typeof csrfToken).toBe("string");

    const resolveResponse = await resolveAdminReport(
      new Request("http://localhost/api/admin/reports/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-csrf-token": csrfToken ?? "",
          cookie: `r2r_session=${sessionToken}; r2r_admin_csrf=${csrfToken}`
        },
        body: JSON.stringify({ id: report.id, queueReverification: false })
      })
    );

    expect(resolveResponse.status).toBe(200);
    const payload = (await resolveResponse.json()) as {
      ok: boolean;
      data?: { reports?: Array<{ status?: string; resolverActorId?: string }> };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data?.reports?.[0]?.status).toBe("resolved");
    expect(payload.data?.reports?.[0]?.resolverActorId).toBe("QingJ01");
  });

  it("rejects resolve when csrf token is missing", async () => {
    const report = await submitCommunityReport({ runId: "run-admin-csrf", reason: "csrf-check" });
    const sessionToken = await issueGithubOAuthSession({ actorId: "QingJ01", accessToken: "gho_admin" });

    const response = await resolveAdminReport(
      new Request("http://localhost/api/admin/reports/resolve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `r2r_session=${sessionToken}`
        },
        body: JSON.stringify({ id: report.id, queueReverification: false })
      })
    );

    expect(response.status).toBe(403);
  });
});

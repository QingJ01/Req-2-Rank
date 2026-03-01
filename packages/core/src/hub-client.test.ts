import { afterEach, describe, expect, it, vi } from "vitest";
import { createHubClient } from "./hub-client.js";

describe("HubClient fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("throws when hub config is missing", async () => {
    const client = createHubClient();
    await expect(client.requestNonce()).rejects.toThrow("Hub is not configured");
    await expect(
      client.submit({
        runId: "run-1",
        nonce: "nonce-1",
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 80,
        submittedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        evidenceChain: {
          timeline: [
            {
              phase: "generate",
              startedAt: "2026-01-01T00:00:00.000Z",
              completedAt: "2026-01-01T00:00:01.000Z",
              model: "system"
            }
          ],
          samples: [
            {
              roundIndex: 0,
              requirement: "demo",
              codeSubmission: "export const ok = true;"
            }
          ],
          environment: {
            os: "win32",
            nodeVersion: "v22",
            timezone: "UTC"
          }
        }
      })
    ).rejects.toThrow("Hub is not configured");

    await expect(client.getLeaderboard({ limit: 2, offset: 1, sort: "asc" })).rejects.toThrow("Hub is not configured");
  });

  it("uses HTTP hub API when serverUrl and token are provided", async () => {
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/api/nonces")) {
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer token-1"
        });
        return new Response(JSON.stringify({ nonce: "nonce-http", expiresAt: "2026-01-01T00:00:00.000Z" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (input.endsWith("/api/submissions")) {
        return new Response(JSON.stringify({ status: "accepted", message: "submitted" }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (input.includes("/api/leaderboard/")) {
        return new Response(JSON.stringify([{ rank: 1, model: "openai/gpt-4o-mini", score: 92 }]), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (input.endsWith("/api/calibration")) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const client = createHubClient({
      serverUrl: "https://hub.example.com",
      token: "token-1"
    });

    const nonce = await client.requestNonce();
    expect(nonce.nonce).toBe("nonce-http");

    const submit = await client.submit({
      runId: "run-2",
      nonce: "nonce-http",
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      overallScore: 90,
      submittedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
      evidenceChain: {
        timeline: [
          {
            phase: "generate",
            startedAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:00:01.000Z",
            model: "system"
          }
        ],
        samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "ok" }],
        environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
      }
    });
    expect(submit.status).toBe("accepted");

    const leaderboard = await client.getLeaderboard({ limit: 10, offset: 0, sort: "desc" });
    expect(leaderboard[0]?.model).toBe("openai/gpt-4o-mini");

    const calibration = await client.submitCalibration({
      recommendedComplexity: "C2",
      reason: "stable",
      averageScore: 80,
      sampleSize: 5,
      source: "cli"
    });
    expect(calibration.ok).toBe(true);
  });
});

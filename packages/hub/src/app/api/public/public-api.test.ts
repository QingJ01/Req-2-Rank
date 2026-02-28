import { describe, expect, it } from "vitest";
import { GET as getPublicLeaderboard } from "./leaderboard/route.js";
import { GET as getPublicLiveStream } from "./live/stream/route.js";
import { GET as getPublicModel } from "./model/[id]/route.js";
import { appStore } from "../../state";

function withEnv<T>(run: () => Promise<T>): Promise<T> {
  const env = process.env as Record<string, string | undefined>;
  const snapshot = {
    NODE_ENV: env.NODE_ENV,
    R2R_PUBLIC_API_KEY: env.R2R_PUBLIC_API_KEY,
    R2R_PUBLIC_API_OPEN: env.R2R_PUBLIC_API_OPEN,
    R2R_PUBLIC_INCLUDE_EVIDENCE: env.R2R_PUBLIC_INCLUDE_EVIDENCE,
  };

  return run().finally(() => {
    env.NODE_ENV = snapshot.NODE_ENV;
    env.R2R_PUBLIC_API_KEY = snapshot.R2R_PUBLIC_API_KEY;
    env.R2R_PUBLIC_API_OPEN = snapshot.R2R_PUBLIC_API_OPEN;
    env.R2R_PUBLIC_INCLUDE_EVIDENCE = snapshot.R2R_PUBLIC_INCLUDE_EVIDENCE;
  });
}

describe("public API", () => {
  it("returns leaderboard response shape", async () => {
    const res = await getPublicLeaderboard(new Request("http://localhost/api/public/leaderboard?limit=2"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok: boolean; data: unknown[] };
    expect(payload.ok).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
  });

  it("exposes SSE stream for live updates", async () => {
    const res = await getPublicLiveStream(new Request("http://localhost/api/public/live/stream?model=openai%2Fgpt-4o-mini"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();
    let text = "";
    for (let index = 0; index < 8; index += 1) {
      const chunk = await reader?.read();
      text += new TextDecoder().decode(chunk?.value ?? new Uint8Array());
      if (
        text.includes("event: leaderboard") &&
        text.includes("event: model-submissions") &&
        text.includes("event: pipeline-progress")
      ) {
        break;
      }
    }
    expect(text).toContain("event: leaderboard");
    expect(text).toContain("event: model-submissions");
    expect(text).toContain("event: pipeline-progress");
    await reader?.cancel();
  });

  it("rejects anonymous public access in production without explicit open mode", async () => {
    await withEnv(async () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = "production";
      delete env.R2R_PUBLIC_API_KEY;
      delete env.R2R_PUBLIC_API_OPEN;

      const res = await getPublicLeaderboard(new Request("http://localhost/api/public/leaderboard"));
      expect(res.status).toBe(401);
    });
  });

  it("allows public access with valid API key in production", async () => {
    await withEnv(async () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = "production";
      env.R2R_PUBLIC_API_KEY = "public-key";
      delete env.R2R_PUBLIC_API_OPEN;

      const unauthorized = await getPublicLeaderboard(new Request("http://localhost/api/public/leaderboard"));
      expect(unauthorized.status).toBe(401);

      const authorized = await getPublicLeaderboard(
        new Request("http://localhost/api/public/leaderboard", { headers: { "x-api-key": "public-key" } })
      );
      expect(authorized.status).toBe(200);
    });
  });

  it("redacts evidence chain in public model payload by default", async () => {
    await withEnv(async () => {
      const env = process.env as Record<string, string | undefined>;
      env.NODE_ENV = "test";
      env.R2R_PUBLIC_API_OPEN = "true";
      delete env.R2R_PUBLIC_API_KEY;
      delete env.R2R_PUBLIC_INCLUDE_EVIDENCE;

      const runId = `run-public-model-${Date.now()}`;
      const provider = "publictest";
      const model = "model-redaction";
      await appStore.saveSubmission({
        runId,
        nonce: `nonce-${Date.now()}`,
        targetProvider: provider,
        targetModel: model,
        complexity: "C3",
        overallScore: 88,
        submittedAt: new Date().toISOString(),
        evidenceChain: {
          timeline: [
            {
              phase: "generate",
              startedAt: "2026-01-01T00:00:00.000Z",
              completedAt: "2026-01-01T00:00:01.000Z",
              model: "system",
            },
          ],
          samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "SECRET_CODE" }],
          environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" },
        },
      });

      const res = await getPublicModel(
        new Request(`http://localhost/api/public/model/${encodeURIComponent(`${provider}/${model}`)}`),
        { params: { id: encodeURIComponent(`${provider}/${model}`) } }
      );

      expect(res.status).toBe(200);
      const payload = (await res.json()) as {
        ok: boolean;
        data: { submissions: Array<{ runId: string; evidenceChain?: unknown }> };
      };
      expect(payload.ok).toBe(true);

      const target = payload.data.submissions.find((item) => item.runId === runId);
      expect(target).toBeDefined();
      expect(target?.evidenceChain).toBeUndefined();
    });
  });
});

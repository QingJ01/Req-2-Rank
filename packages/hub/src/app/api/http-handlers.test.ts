import { describe, expect, it } from "vitest";
import { GET as getLeaderboard } from "./leaderboard/[complexity]/[[dimension]]/route.js";
import { GET as getModel } from "./model/[id]/route.js";
import { POST as postNonce } from "./nonces/route.js";
import { POST as postSubmit } from "./submissions/route.js";

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("http-style app route handlers", () => {
  it("supports nonce -> submit -> leaderboard -> model via HTTP handlers", async () => {
    const token = "dev-token";

    const nonceRes = await postNonce(
      new Request("http://localhost/api/nonces", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-actor-id": "user-1",
          "content-type": "application/json"
        },
        body: JSON.stringify({ userId: "user-1" })
      })
    );
    expect(nonceRes.status).toBe(200);
    const noncePayload = await readJson<{ ok: boolean; data: { nonce: string } }>(nonceRes);
    expect(noncePayload.ok).toBe(true);

    const submitRes = await postSubmit(
      new Request("http://localhost/api/submissions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "x-actor-id": "user-1",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          runId: "run-http-1",
          nonce: noncePayload.data.nonce,
          targetProvider: "openai",
          targetModel: "gpt-4o-mini",
          overallScore: 92,
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
        })
      })
    );
    expect(submitRes.status).toBe(200);

    const lbRes = await getLeaderboard(
      new Request("http://localhost/api/leaderboard/all?limit=5&offset=0&sort=desc", {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "x-actor-id": "user-1"
        }
      }),
      { params: { complexity: "all" } }
    );
    expect(lbRes.status).toBe(200);
    const lbPayload = await readJson<{ ok: boolean; data: Array<{ model: string }> }>(lbRes);
    expect(lbPayload.ok).toBe(true);
    expect(lbPayload.data[0]?.model).toBe("openai/gpt-4o-mini");

    const modelRes = await getModel(
      new Request("http://localhost/api/model/openai%2Fgpt-4o-mini", {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          "x-actor-id": "user-1"
        }
      }),
      { params: { id: "openai%2Fgpt-4o-mini" } }
    );
    expect(modelRes.status).toBe(200);
    const modelPayload = await readJson<{ ok: boolean; data: { model: string } }>(modelRes);
    expect(modelPayload.ok).toBe(true);
    expect(modelPayload.data.model).toBe("openai/gpt-4o-mini");
  });
});

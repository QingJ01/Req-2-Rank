import { describe, expect, it } from "vitest";
import { handleFlagRequest } from "./app/api/flag/route.js";
import { handleLeaderboardRequest } from "./app/api/leaderboard/[complexity]/[[dimension]]/route.js";
import { handleModelRequest } from "./app/api/model/[id]/route.js";
import { handleNonceRequest } from "./app/api/nonces/route.js";
import { handleSubmissionRequest } from "./app/api/submission/[id]/route.js";
import { handleSubmitRequest } from "./app/api/submissions/route.js";

describe("hub app route shims", () => {
  it("returns auth error without valid token", async () => {
    const result = await handleNonceRequest({
      actorId: "user-1",
      headers: {},
      body: { userId: "user-1" }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth error");
    }
    expect(result.error.code).toBe("AUTH_ERROR");
  });

  it("supports nonce -> submit -> leaderboard flow via app routes", async () => {
    const token = "dev-token";

    const nonce = await handleNonceRequest({
      actorId: "user-1",
      headers: { authorization: `Bearer ${token}` },
      body: { userId: "user-1" }
    });
    expect(nonce.ok).toBe(true);
    if (!nonce.ok) {
      throw new Error("expected nonce success");
    }

    const submit = await handleSubmitRequest({
      actorId: "user-1",
      headers: { authorization: `Bearer ${token}` },
      body: {
        runId: "run-app-1",
        nonce: nonce.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 91,
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
      }
    });

    expect(submit.ok).toBe(true);

    const submissionDetail = await handleSubmissionRequest({
      actorId: "user-1",
      headers: { authorization: `Bearer ${token}` },
      params: { id: "run-app-1" }
    });
    expect(submissionDetail.ok).toBe(true);
    if (!submissionDetail.ok) {
      throw new Error("expected submission detail success");
    }
    expect(submissionDetail.data.runId).toBe("run-app-1");

    const modelDetail = await handleModelRequest({
      actorId: "user-1",
      headers: { authorization: `Bearer ${token}` },
      params: { id: "openai%2Fgpt-4o-mini" }
    });
    expect(modelDetail.ok).toBe(true);
    if (!modelDetail.ok) {
      throw new Error("expected model detail success");
    }
    expect(modelDetail.data.model).toBe("openai/gpt-4o-mini");
    expect(modelDetail.data.submissions.length).toBeGreaterThan(0);

    const flag = await handleFlagRequest({
      actorId: "user-1",
      headers: { authorization: `Bearer ${token}` },
      body: { runId: "run-app-1" }
    });
    expect(flag.ok).toBe(true);
    if (!flag.ok) {
      throw new Error("expected flag success");
    }
    expect(flag.data.reason).toBe("flagged");

    const leaderboard = await handleLeaderboardRequest({
      actorId: "user-1",
      headers: { authorization: `Bearer ${token}` },
      params: { complexity: "all" },
      query: { limit: "5", offset: "0", sort: "desc" }
    });

    expect(leaderboard.ok).toBe(true);
    if (!leaderboard.ok) {
      throw new Error("expected leaderboard success");
    }
    expect(leaderboard.data[0]?.model).toBe("openai/gpt-4o-mini");
  });
});

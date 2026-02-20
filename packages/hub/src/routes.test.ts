import { describe, expect, it } from "vitest";
import {
  createFlagSubmissionHandler,
  createAuthValidator,
  createLeaderboardHandler,
  createNonceHandler,
  createSubmissionStore,
  createSubmitHandler,
  postNonceRoute,
  postSubmitRoute
} from "./routes.js";

describe("hub route skeletons", () => {
  it("enforces nonce lifecycle: issue, consume once, then reject reuse", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);
    const todayIso = new Date().toISOString();

    const nonceResult = await nonceHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: { userId: "user-1" }
    });

    expect(nonceResult.ok).toBe(true);
    if (!nonceResult.ok) {
      throw new Error("expected nonce success");
    }

    const firstSubmit = await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-nonce-1",
        nonce: nonceResult.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 88,
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
    expect(firstSubmit.ok).toBe(true);

    const secondSubmit = await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-nonce-2",
        nonce: nonceResult.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 89,
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

    expect(secondSubmit.ok).toBe(false);
    if (secondSubmit.ok) {
      throw new Error("expected nonce reuse failure");
    }
    expect(secondSubmit.error.message).toContain("already used");
  });

  it("rejects unauthenticated requests with AUTH_ERROR", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const handler = createNonceHandler(validate, store);

    const result = await handler({
      actorId: "user-1",
      authToken: "bad-token",
      body: { userId: "user-1" }
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth failure");
    }
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("AUTH_ERROR");
  });

  it("returns leaderboard from accepted submissions", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);
    const leaderboardHandler = createLeaderboardHandler(validate, store);

    const nonce1 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    const nonce2 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    if (!nonce1.ok || !nonce2.ok) {
      throw new Error("expected nonce success");
    }

    await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-lb-1",
        nonce: nonce1.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        complexity: "C3",
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
      }
    });

    await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-lb-2",
        nonce: nonce2.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        complexity: "C2",
        overallScore: 85,
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

    const leaderboard = await leaderboardHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: { limit: 5, offset: 0, sort: "desc", complexity: "C3" }
    });

    expect(leaderboard.ok).toBe(true);
    if (!leaderboard.ok) {
      throw new Error("expected leaderboard success");
    }
    expect(leaderboard.data[0]?.model).toBe("openai/gpt-4o-mini");
    expect(leaderboard.data[0]?.score).toBe(90);
  });

  it("supports dimension sorting", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);
    const leaderboardHandler = createLeaderboardHandler(validate, store);

    const nonce1 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    const nonce2 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    if (!nonce1.ok || !nonce2.ok) {
      throw new Error("expected nonce success");
    }

    await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-dim-1",
        nonce: nonce1.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        complexity: "C2",
        overallScore: 85,
        dimensionScores: {
          functionalCompleteness: 80,
          codeQuality: 75,
          logicAccuracy: 78,
          security: 70,
          engineeringPractice: 82
        },
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

    await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-dim-2",
        nonce: nonce2.data.nonce,
        targetProvider: "anthropic",
        targetModel: "claude-sonnet",
        complexity: "C2",
        overallScore: 83,
        dimensionScores: {
          functionalCompleteness: 84,
          codeQuality: 82,
          logicAccuracy: 83,
          security: 95,
          engineeringPractice: 84
        },
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

    const leaderboard = await leaderboardHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: { limit: 5, offset: 0, sort: "desc", dimension: "security" }
    });

    expect(leaderboard.ok).toBe(true);
    if (!leaderboard.ok) {
      throw new Error("expected leaderboard success");
    }
    expect(leaderboard.data[0]?.model).toBe("anthropic/claude-sonnet");
  });

  it("rejects submission when timeline phases are out of order", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);

    const nonce = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    if (!nonce.ok) {
      throw new Error("expected nonce success");
    }

    const submit = await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-bad-timeline",
        nonce: nonce.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 80,
        submittedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        evidenceChain: {
          timeline: [
            {
              phase: "execute",
              startedAt: "2026-01-01T00:00:00.000Z",
              completedAt: "2026-01-01T00:00:01.000Z",
              model: "target"
            },
            {
              phase: "generate",
              startedAt: "2026-01-01T00:00:02.000Z",
              completedAt: "2026-01-01T00:00:03.000Z",
              model: "system"
            }
          ],
          samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "ok" }],
          environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
        }
      }
    });

    expect(submit.ok).toBe(false);
    if (submit.ok) {
      throw new Error("expected validation error");
    }
    expect(submit.error.message).toContain("timeline");
  });

  it("creates reverification job for top-score submissions and allows flagged jobs", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);
    const flagHandler = createFlagSubmissionHandler(validate, store);

    const nonce = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    if (!nonce.ok) {
      throw new Error("expected nonce success");
    }

    const submit = await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-top",
        nonce: nonce.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 96,
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

    const flagged = await flagHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: { runId: "run-top" }
    });
    expect(flagged.ok).toBe(true);
    if (!flagged.ok) {
      throw new Error("expected flag success");
    }
    expect(flagged.data.status).toBe("queued");
  });

  it("preserves dimension scores and evidence chain in submission detail", async () => {
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);

    const nonce = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    if (!nonce.ok) {
      throw new Error("expected nonce success");
    }

    await submitHandler({
      actorId: "user-1",
      authToken: "token-1",
      body: {
        runId: "run-detail-1",
        nonce: nonce.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 87,
        dimensionScores: {
          functionalCompleteness: 88,
          codeQuality: 86,
          logicAccuracy: 90,
          security: 80,
          engineeringPractice: 84
        },
        submittedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
        evidenceChain: {
          timeline: [
            {
              phase: "generate",
              startedAt: "2026-01-01T00:00:00.000Z",
              completedAt: "2026-01-01T00:00:01.000Z",
              model: "system"
            },
            {
              phase: "execute",
              startedAt: "2026-01-01T00:00:01.000Z",
              completedAt: "2026-01-01T00:00:03.000Z",
              model: "target"
            }
          ],
          samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "export const ok = true;" }],
          environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
        }
      }
    });

    const detail = await store.getSubmission("run-detail-1");
    expect(detail).toBeDefined();
    expect(detail?.dimensionScores.logicAccuracy).toBe(90);
    expect(detail?.evidenceChain?.timeline).toHaveLength(2);
    expect(detail?.evidenceChain?.samples[0]?.codeSubmission).toContain("ok");
  });

  it("enforces daily submission limit per actor", async () => {
    process.env.R2R_DAILY_SUBMISSION_LIMIT = "2";
    const store = createSubmissionStore();
    const validate = createAuthValidator("token-1");
    const nonceHandler = createNonceHandler(validate, store);
    const submitHandler = createSubmitHandler(validate, store);
    const todayIso = new Date().toISOString();

    const makeBody = (runId: string, nonce: string) => ({
      runId,
      nonce,
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      overallScore: 88,
      submittedAt: todayIso,
      evidenceChain: {
        timeline: [
          {
            phase: "generate" as const,
            startedAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:00:01.000Z",
            model: "system"
          }
        ],
        samples: [{ roundIndex: 0, requirement: "demo", codeSubmission: "ok" }],
        environment: { os: "win32", nodeVersion: "v22", timezone: "UTC" }
      }
    });

    const nonce1 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    const nonce2 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    const nonce3 = await nonceHandler({ actorId: "user-1", authToken: "token-1", body: { userId: "user-1" } });
    if (!nonce1.ok || !nonce2.ok || !nonce3.ok) {
      throw new Error("expected nonce success");
    }

    const submit1 = await submitHandler({ actorId: "user-1", authToken: "token-1", body: makeBody("run-limit-1", nonce1.data.nonce) });
    const submit2 = await submitHandler({ actorId: "user-1", authToken: "token-1", body: makeBody("run-limit-2", nonce2.data.nonce) });
    const submit3 = await submitHandler({ actorId: "user-1", authToken: "token-1", body: makeBody("run-limit-3", nonce3.data.nonce) });

    expect(submit1.ok).toBe(true);
    expect(submit2.ok).toBe(true);
    expect(submit3.ok).toBe(false);
    if (submit3.ok) {
      throw new Error("expected daily limit failure");
    }
    expect(submit3.error.message).toContain("daily submission limit");

    delete process.env.R2R_DAILY_SUBMISSION_LIMIT;
  });

  it("returns nonce payload", async () => {
    const response = await postNonceRoute({ userId: "user-1" });
    expect(response.nonce.length).toBeGreaterThan(0);
    expect(response.expiresAt).toContain("T");
  });

  it("validates submit payload and returns accepted response", async () => {
    const response = await postSubmitRoute({
      runId: "run-1",
      nonce: "nonce-1",
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      overallScore: 87,
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
    });

    expect(response.status).toBe("accepted");
  });

  it("returns empty leaderboard when store has no submissions", async () => {
    const handler = createLeaderboardHandler(async () => {}, createSubmissionStore());
    const result = await handler({ actorId: "user-1", body: { limit: 2, offset: 0, sort: "asc" } });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success envelope");
    }
    expect(result.data).toHaveLength(0);
  });

  it("rejects invalid leaderboard pagination", async () => {
    const handler = createLeaderboardHandler(async () => {}, createSubmissionStore());
    const result = await handler({ actorId: "user-1", body: { limit: 0, offset: -1, sort: "desc" } });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected validation error envelope");
    }
    expect(result.error.message).toContain("limit must be a positive integer");
  });

  it("supports composed nonce/submit handlers with shared validation hook", async () => {
    const events: string[] = [];
    const validate = async (actorId: string) => {
      events.push(`validate:${actorId}`);
    };

    const nonceHandler = createNonceHandler(validate);
    const submitHandler = createSubmitHandler(validate);

    const nonceResult = await nonceHandler({ actorId: "user-1", body: { userId: "user-1" } });
    expect(nonceResult.ok).toBe(true);
    if (!nonceResult.ok) {
      throw new Error("expected nonce success envelope");
    }

    const submitResult = await submitHandler({
      actorId: "user-1",
      body: {
        runId: "run-2",
        nonce: nonceResult.data.nonce,
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 88,
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
    expect(submitResult.ok).toBe(true);

    expect(events).toEqual(["validate:user-1", "validate:user-1"]);
  });

  it("returns validation error envelope for invalid submit payload", async () => {
    const submitHandler = createSubmitHandler(async () => {});

    const result = await submitHandler({
      actorId: "user-1",
      body: {
        runId: "run-3",
        nonce: "nonce-3",
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        overallScore: 999,
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

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected error envelope");
    }
    expect(result.status).toBe(400);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns auth error envelope when validation hook fails", async () => {
    const nonceHandler = createNonceHandler(async () => {
      throw new Error("not authorized");
    });

    const result = await nonceHandler({ actorId: "user-1", body: { userId: "user-1" } });
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth error envelope");
    }
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("AUTH_ERROR");
  });

  it("returns success envelope for composed leaderboard handler", async () => {
    const handler = createLeaderboardHandler(async () => {}, createSubmissionStore());
    const result = await handler({ actorId: "user-1", body: { limit: 2, offset: 1, sort: "asc" } });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected success envelope");
    }
    expect(result.data).toHaveLength(0);
  });

  it("returns validation error envelope for composed leaderboard handler", async () => {
    const handler = createLeaderboardHandler(async () => {});
    const result = await handler({ actorId: "user-1", body: { limit: 0 } });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected validation error envelope");
    }
    expect(result.status).toBe(400);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns auth error envelope for composed leaderboard handler", async () => {
    const handler = createLeaderboardHandler(async () => {
      throw new Error("not authorized");
    });
    const result = await handler({ actorId: "user-1", body: { limit: 2 } });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected auth error envelope");
    }
    expect(result.status).toBe(401);
    expect(result.error.code).toBe("AUTH_ERROR");
  });
});

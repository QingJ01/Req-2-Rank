import { describe, expect, it } from "vitest";
import { createSubmissionStore } from "./routes.js";
import { processQueuedReverificationJobs } from "./reverification-worker.js";

describe("reverification worker", () => {
  it("processes queued jobs and updates verification status", async () => {
    const store = createSubmissionStore();
    await store.saveSubmission({
      runId: "run-job-1",
      nonce: "n-1",
      targetProvider: "openai",
      targetModel: "gpt-4o-mini",
      overallScore: 96,
      ci95: [90, 100],
      agreementLevel: "low",
      dimensionScores: { logicAccuracy: 90 },
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
    await store.queueReverification("run-job-1", "flagged");

    const result = await processQueuedReverificationJobs(store, {
      maxJobs: 10,
      replayRunner: async () => ({
        overallScore: 70,
        ijaScore: 0.4
      })
    });
    expect(result.processed).toBeGreaterThan(0);

    const updated = await store.getSubmission("run-job-1");
    expect(updated?.verificationStatus).toBe("disputed");
  });
});

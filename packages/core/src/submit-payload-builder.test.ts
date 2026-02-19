import { describe, expect, it } from "vitest";
import { buildSubmissionPayload } from "./submit-payload-builder.js";

describe("buildSubmissionPayload", () => {
  it("builds payload with nonce and evidence chain", () => {
    const payload = buildSubmissionPayload({
      run: {
        id: "run-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        targetProvider: "openai",
        targetModel: "gpt-4o-mini",
        complexity: "C1",
        rounds: 1,
        requirementTitle: "demo requirement",
        overallScore: 88,
        ci95: [86, 90],
        agreementLevel: "high",
        dimensionScores: {
          functionalCompleteness: 88,
          codeQuality: 88,
          logicAccuracy: 88,
          security: 88,
          engineeringPractice: 88
        }
      },
      nonce: "nonce-1",
      now: new Date("2026-01-01T00:00:02.000Z")
    });

    expect(payload.runId).toBe("run-1");
    expect(payload.nonce).toBe("nonce-1");
    expect(payload.evidenceChain.timeline).toHaveLength(4);
  });
});

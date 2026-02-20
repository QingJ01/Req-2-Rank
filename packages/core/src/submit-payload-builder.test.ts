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
        ijaScore: 0.92,
        dimensionScores: {
          functionalCompleteness: 88,
          codeQuality: 88,
          logicAccuracy: 88,
          security: 88,
          engineeringPractice: 88
        },
        evidenceChain: {
          timeline: [
            {
              phase: "generate",
              startedAt: "2026-01-01T00:00:00.000Z",
              completedAt: "2026-01-01T00:00:01.000Z",
              model: "anthropic/claude-sonnet"
            },
            {
              phase: "execute",
              startedAt: "2026-01-01T00:00:01.000Z",
              completedAt: "2026-01-01T00:00:02.000Z",
              model: "openai/gpt-4o-mini"
            },
            {
              phase: "evaluate",
              startedAt: "2026-01-01T00:00:02.000Z",
              completedAt: "2026-01-01T00:00:03.000Z",
              model: "openai/gpt-4o"
            },
            {
              phase: "score",
              startedAt: "2026-01-01T00:00:03.000Z",
              completedAt: "2026-01-01T00:00:04.000Z",
              model: "scoring-engine"
            }
          ],
          samples: [
            {
              roundIndex: 0,
              requirement: "Build API",
              codeSubmission: "export const ok = true;"
            }
          ],
          environment: {
            os: "win32",
            nodeVersion: "v22",
            timezone: "UTC"
          }
        }
      },
      nonce: "nonce-1",
      now: new Date("2026-01-01T00:00:02.000Z")
    });

    expect(payload.runId).toBe("run-1");
    expect(payload.nonce).toBe("nonce-1");
    expect(payload.complexity).toBe("C1");
    expect(payload.evidenceChain.samples[0]?.codeSubmission).toBe("export const ok = true;");
  });
});

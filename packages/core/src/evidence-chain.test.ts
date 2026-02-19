import { describe, expect, it } from "vitest";
import { createEvidenceChain } from "./evidence-chain.js";

describe("createEvidenceChain", () => {
  it("builds timeline samples and environment fields", () => {
    const chain = createEvidenceChain({
      requirement: "Build API",
      codeSubmission: "export const ok = true;",
      judgeModels: ["openai/gpt-4o"],
      now: new Date("2026-01-01T00:00:00.000Z")
    });

    expect(chain.timeline).toHaveLength(4);
    expect(chain.samples).toHaveLength(1);
    expect(chain.environment.os.length).toBeGreaterThan(0);
  });
});

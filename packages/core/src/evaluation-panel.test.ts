import { describe, expect, it } from "vitest";
import { calculateIja, EvaluationPanel, JudgeConfig } from "./evaluation-panel.js";
import { LLMProvider } from "./providers/base.js";
import { ProjectRequirement } from "./types.js";

class StubJudgeProvider implements LLMProvider {
  id = "stub-judge";
  name = "Stub Judge";

  async chat(): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number }; latencyMs: number }> {
    return {
      content: JSON.stringify({
        functionalCompleteness: 84,
        codeQuality: 79,
        logicAccuracy: 86,
        security: 75,
        engineeringPractice: 80
      }),
      usage: { promptTokens: 10, completionTokens: 12 },
      latencyMs: 15
    };
  }
}

class ThrowingJudgeProvider implements LLMProvider {
  id = "throw-judge";
  name = "Throw Judge";

  async chat(): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number }; latencyMs: number }> {
    throw new Error("judge unavailable");
  }
}

function makeRequirement(): ProjectRequirement {
  return {
    id: "req-1",
    version: "1.0",
    title: "Demo",
    description: "Do demo",
    functionalRequirements: [
      {
        id: "FR-1",
        description: "Implement feature",
        acceptanceCriteria: "Feature works",
        priority: "must"
      }
    ],
    constraints: [],
    expectedDeliverables: ["source code"],
    metadata: {
      skills: ["api-design"],
      complexity: "C2",
      domain: "generic",
      scenario: "demo",
      techStack: ["typescript"],
      mutationLog: []
    },
    evaluationGuidance: {
      keyDifferentiators: ["clean structure"],
      commonPitfalls: ["missing validation"],
      edgeCases: ["empty input"]
    },
    generatedBy: "test",
    generatedAt: new Date().toISOString(),
    selfReviewPassed: true
  };
}

describe("calculateIja", () => {
  it("returns high agreement when judges are close", () => {
    const ija = calculateIja([
      {
        judgeId: "j1",
        dimensions: {
          functionalCompleteness: 80,
          codeQuality: 79,
          logicAccuracy: 81,
          security: 78,
          engineeringPractice: 80
        }
      },
      {
        judgeId: "j2",
        dimensions: {
          functionalCompleteness: 81,
          codeQuality: 80,
          logicAccuracy: 82,
          security: 79,
          engineeringPractice: 81
        }
      }
    ]);

    expect(ija).toBeGreaterThan(0.9);
  });

  it("returns low agreement when judges diverge strongly", () => {
    const ija = calculateIja([
      {
        judgeId: "j1",
        dimensions: {
          functionalCompleteness: 20,
          codeQuality: 20,
          logicAccuracy: 20,
          security: 20,
          engineeringPractice: 20
        }
      },
      {
        judgeId: "j2",
        dimensions: {
          functionalCompleteness: 95,
          codeQuality: 95,
          logicAccuracy: 95,
          security: 95,
          engineeringPractice: 95
        }
      }
    ]);

    expect(ija).toBe(0);
  });

  it("evaluates through judge providers and parses structured scores", async () => {
    const panel = new EvaluationPanel();
    const requirement = makeRequirement();
    const execution = {
      code: "export const answer = 42;",
      language: "typescript",
      timeoutMs: 60_000,
      maxTokens: 8_192
    };
    const judges: JudgeConfig[] = [{ provider: "openai", model: "gpt-4o", weight: 1 }];
    const provider = new StubJudgeProvider();

    const results = await panel.evaluate(requirement, execution, judges, () => provider);

    expect(results).toHaveLength(1);
    expect(results[0].dimensions.logicAccuracy).toBe(86);
    expect(results[0].judgeId).toBe("openai/gpt-4o");
  });

  it("tolerates failed judges when at least one judge succeeds", async () => {
    const panel = new EvaluationPanel();
    const requirement = makeRequirement();
    const execution = {
      code: "export const answer = 42;",
      language: "typescript",
      timeoutMs: 60_000,
      maxTokens: 8_192
    };

    const judges: JudgeConfig[] = [
      { provider: "openai", model: "gpt-4o", weight: 1 },
      { provider: "openai", model: "gpt-4o-mini", weight: 1 }
    ];
    const stable = new StubJudgeProvider();
    const flaky = new ThrowingJudgeProvider();

    const output = await panel.evaluateWithIja(requirement, execution, judges, (judge) =>
      judge.model === "gpt-4o" ? stable : flaky
    );

    expect(output.results).toHaveLength(1);
    expect(output.droppedJudges).toContain("openai/gpt-4o-mini");
  });

  it("throws when all judges fail", async () => {
    const panel = new EvaluationPanel();
    const requirement = makeRequirement();
    const execution = {
      code: "export const answer = 42;",
      language: "typescript",
      timeoutMs: 60_000,
      maxTokens: 8_192
    };
    const judges: JudgeConfig[] = [{ provider: "openai", model: "gpt-4o", weight: 1 }];

    await expect(panel.evaluateWithIja(requirement, execution, judges, () => new ThrowingJudgeProvider())).rejects.toThrow(
      "all judges failed"
    );
  });
});

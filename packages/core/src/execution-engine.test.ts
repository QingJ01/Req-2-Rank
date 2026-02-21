import { describe, expect, it } from "vitest";
import { LLMProvider } from "./providers/base.js";
import { ExecutionEngine, parseExecutionResponse, resolveExecutionBudget } from "./execution-engine.js";
import { ProjectRequirement } from "./types.js";

class StubProvider implements LLMProvider {
  id = "stub";
  name = "Stub";
  callCount = 0;

  async chat(): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number }; latencyMs: number }> {
    this.callCount += 1;
    return {
      content: "```ts\nexport const run = () => 'ok';\n```",
      usage: { promptTokens: 10, completionTokens: 20 },
      latencyMs: 12
    };
  }
}

function makeRequirement(complexity: "C1" | "C2" | "C3" | "C4"): ProjectRequirement {
  return {
    id: "req-1",
    version: "1.0",
    title: "Demo requirement",
    description: "demo",
    functionalRequirements: [
      {
        id: "FR-1",
        description: "Do work",
        acceptanceCriteria: "Works",
        priority: "must"
      }
    ],
    constraints: [],
    expectedDeliverables: ["source code"],
    metadata: {
      skills: ["api-design"],
      complexity,
      domain: "generic",
      scenario: "demo",
      techStack: ["typescript"],
      mutationLog: []
    },
    evaluationGuidance: {
      keyDifferentiators: [],
      commonPitfalls: [],
      edgeCases: []
    },
    generatedBy: "test",
    generatedAt: new Date().toISOString(),
    selfReviewPassed: true
  };
}

describe("ExecutionEngine", () => {
  it("maps C1-C4 complexity to timeout and token budgets", () => {
    expect(resolveExecutionBudget("C1")).toEqual({ timeoutMs: 30_000, maxTokens: 4_096 });
    expect(resolveExecutionBudget("C2")).toEqual({ timeoutMs: 60_000, maxTokens: 8_192 });
    expect(resolveExecutionBudget("C3")).toEqual({ timeoutMs: 120_000, maxTokens: 16_384 });
    expect(resolveExecutionBudget("C4")).toEqual({ timeoutMs: 180_000, maxTokens: 32_768 });
  });

  it("falls back to fenced-code parsing when JSON parsing fails", () => {
    const parsed = parseExecutionResponse("```ts\nexport const answer = 42;\n```");

    expect(parsed.language).toBe("ts");
    expect(parsed.code).toContain("answer = 42");
  });

  it("parses fenced-code blocks with CRLF newlines", () => {
    const parsed = parseExecutionResponse("```ts\r\nexport const answer = 42;\r\n```");

    expect(parsed.language).toBe("ts");
    expect(parsed.code).toContain("answer = 42");
  });

  it("uses requirement complexity budget during execute", async () => {
    const provider = new StubProvider();
    const engine = new ExecutionEngine();
    const requirement = makeRequirement("C4");

    const result = await engine.execute(requirement, { provider: "openai", model: "gpt-4o-mini" }, { provider });

    expect(result.timeoutMs).toBe(180_000);
    expect(result.maxTokens).toBe(32_768);
    expect(result.code).toContain("run = () => 'ok'");
    expect(provider.callCount).toBe(1);
  });

  it("still allows deterministic raw response override", async () => {
    const provider = new StubProvider();
    const engine = new ExecutionEngine();
    const requirement = makeRequirement("C2");

    const result = await engine.execute(
      requirement,
      { provider: "openai", model: "gpt-4o-mini" },
      { provider, rawResponse: "```ts\nexport const answer = 42;\n```" }
    );

    expect(result.code).toContain("answer = 42");
    expect(provider.callCount).toBe(0);
  });
});

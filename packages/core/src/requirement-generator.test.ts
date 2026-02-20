import { describe, expect, it } from "vitest";
import { LLMProvider } from "./providers/base.js";
import { RequirementGenerator } from "./requirement-generator.js";

class StubProvider implements LLMProvider {
  id = "stub";
  name = "Stub";
  callCount = 0;

  async chat(): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number }; latencyMs: number }> {
    this.callCount += 1;
    if (this.callCount === 1) {
      return {
        content: "Draft requirement text.",
        usage: { promptTokens: 10, completionTokens: 20 },
        latencyMs: 5
      };
    }

    if (this.callCount === 2) {
      return {
        content: "Reviewed requirement text.",
        usage: { promptTokens: 11, completionTokens: 21 },
        latencyMs: 6
      };
    }

    return {
      content: JSON.stringify({
        title: "Generated requirement",
        description: "Detailed generated requirement",
        functionalRequirements: [
          {
            id: "FR-1",
            description: "Implement API endpoint",
            acceptanceCriteria: "Request returns expected payload",
            priority: "must"
          },
          {
            id: "FR-2",
            description: "Handle invalid input",
            acceptanceCriteria: "Invalid payload returns 400",
            priority: "must"
          }
        ],
        constraints: ["Use TypeScript"],
        expectedDeliverables: ["source code", "tests"],
        exampleIO: [
          {
            input: "POST /orders with valid payload",
            expectedOutput: "201 Created with order id"
          }
        ],
        evaluationGuidance: {
          keyDifferentiators: ["robust validation"],
          commonPitfalls: ["missing error handling"],
          edgeCases: ["empty request body"]
        },
        selfReviewPassed: true
      }),
      usage: { promptTokens: 12, completionTokens: 22 },
      latencyMs: 7
    };
  }
}

describe("RequirementGenerator", () => {
  it("returns deterministic seed metadata with fixed seed", async () => {
    const provider = new StubProvider();
    const generator = new RequirementGenerator();
    const input = {
      skills: ["api-design", "error-handling"],
      complexity: "C2" as const,
      domain: "ecommerce",
      scenario: "order-state",
      techStack: ["typescript"],
      seed: "fixed-seed"
    };

    const first = await generator.generate(input, { provider, model: "gpt-4o-mini" });
    const second = await generator.generate(input, { provider, model: "gpt-4o-mini" });

    expect(first.metadata.seedId).toBe(second.metadata.seedId);
    expect(first.metadata.mutationLog).toEqual(second.metadata.mutationLog);
  });

  it("injects additional constraints", async () => {
    const provider = new StubProvider();
    const generator = new RequirementGenerator();
    const result = await generator.generate(
      {
        skills: ["data-processing"],
        complexity: "C1",
        domain: "analytics",
        scenario: "log-parser",
        techStack: ["typescript"],
        seed: "constraint-seed",
        extraConstraints: ["must finish under 100 lines"]
      },
      { provider, model: "gpt-4o-mini" }
    );

    expect(result.constraints).toContain("must finish under 100 lines");
    expect(result.metadata.mutationLog.some((entry) => entry.startsWith("extra-constraints:"))).toBe(true);
  });

  it("runs a three-stage prompt pipeline", async () => {
    const provider = new StubProvider();
    const generator = new RequirementGenerator();

    const result = await generator.generate(
      {
        skills: ["api-design", "error-handling"],
        complexity: "C2",
        domain: "ecommerce",
        scenario: "order-state",
        techStack: ["typescript"],
        seed: "stage-seed"
      },
      { provider, model: "gpt-4o-mini" }
    );

    expect(provider.callCount).toBe(3);
    expect(result.functionalRequirements.length).toBeGreaterThanOrEqual(2);
    expect(result.title).toBe("Generated requirement");
    expect(result.exampleIO?.[0]?.input).toContain("POST /orders");
  });

  it("supports C3/C4 generation with richer seeds", async () => {
    const provider = new StubProvider();
    const generator = new RequirementGenerator();

    const c3 = await generator.generate(
      {
        skills: ["distributed-systems", "api-design"],
        complexity: "C3",
        domain: "platform",
        scenario: "orchestration",
        techStack: ["typescript"],
        seed: "c3-seed"
      },
      { provider, model: "gpt-4o-mini" }
    );

    const c4 = await generator.generate(
      {
        skills: ["security", "governance"],
        complexity: "C4",
        domain: "banking",
        scenario: "compliance",
        techStack: ["typescript"],
        seed: "c4-seed"
      },
      { provider, model: "gpt-4o-mini" }
    );

    expect(c3.metadata.complexity).toBe("C3");
    expect(c4.metadata.complexity).toBe("C4");
    expect(c3.metadata.seedId).toBeTruthy();
    expect(c4.metadata.seedId).toBeTruthy();
  });

  it("samples domain taxonomy for generic pipeline input", async () => {
    const provider = new StubProvider();
    const generator = new RequirementGenerator();

    const generated = await generator.generate(
      {
        skills: ["api-design", "error-handling"],
        complexity: "C2",
        domain: "generic",
        scenario: "pipeline-eval",
        techStack: ["typescript"],
        seed: "taxonomy-seed"
      },
      { provider, model: "gpt-4o-mini" }
    );

    expect(generated.metadata.domain).not.toBe("generic");
    expect(generated.metadata.scenario).not.toBe("pipeline-eval");
  });
});

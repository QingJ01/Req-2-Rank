import { describe, expect, it } from "vitest";
import { RequirementGenerator } from "./requirement-generator.js";

describe("RequirementGenerator", () => {
  it("returns deterministic result with fixed seed", () => {
    const generator = new RequirementGenerator();
    const input = {
      skills: ["api-design", "error-handling"],
      complexity: "C2" as const,
      domain: "ecommerce",
      scenario: "order-state",
      techStack: ["typescript"],
      seed: "fixed-seed"
    };

    const first = generator.generate(input);
    const second = generator.generate(input);

    expect(first.description).toBe(second.description);
    expect(first.metadata.seedId).toBe(second.metadata.seedId);
    expect(first.metadata.mutationLog).toEqual(second.metadata.mutationLog);
  });

  it("injects additional constraints", () => {
    const generator = new RequirementGenerator();
    const result = generator.generate({
      skills: ["data-processing"],
      complexity: "C1",
      domain: "analytics",
      scenario: "log-parser",
      techStack: ["typescript"],
      seed: "constraint-seed",
      extraConstraints: ["must finish under 100 lines"]
    });

    expect(result.constraints).toContain("must finish under 100 lines");
    expect(result.metadata.mutationLog.some((entry) => entry.startsWith("extra-constraints:"))).toBe(true);
  });

  it("supports C3/C4 generation with richer seeds", () => {
    const generator = new RequirementGenerator();

    const c3 = generator.generate({
      skills: ["distributed-systems", "api-design"],
      complexity: "C3",
      domain: "platform",
      scenario: "orchestration",
      techStack: ["typescript"],
      seed: "c3-seed"
    });

    const c4 = generator.generate({
      skills: ["security", "governance"],
      complexity: "C4",
      domain: "banking",
      scenario: "compliance",
      techStack: ["typescript"],
      seed: "c4-seed"
    });

    expect(c3.metadata.complexity).toBe("C3");
    expect(c4.metadata.complexity).toBe("C4");
    expect(c3.metadata.seedId).toBeTruthy();
    expect(c4.metadata.seedId).toBeTruthy();
  });
});

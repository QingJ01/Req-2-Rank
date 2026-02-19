import { describe, expect, it } from "vitest";
import { ScoringEngine } from "./scoring-engine.js";

describe("ScoringEngine", () => {
  it("calculates weighted dimension and overall scores", () => {
    const engine = new ScoringEngine({
      functionalCompleteness: 0.3,
      codeQuality: 0.25,
      logicAccuracy: 0.25,
      security: 0.1,
      engineeringPractice: 0.1
    });

    const result = engine.score([
      {
        judgeId: "j1",
        dimensions: {
          functionalCompleteness: 80,
          codeQuality: 70,
          logicAccuracy: 90,
          security: 85,
          engineeringPractice: 75
        }
      },
      {
        judgeId: "j2",
        dimensions: {
          functionalCompleteness: 60,
          codeQuality: 90,
          logicAccuracy: 70,
          security: 95,
          engineeringPractice: 85
        }
      }
    ]);

    expect(result.dimensionScores.functionalCompleteness).toBe(70);
    expect(result.dimensionScores.codeQuality).toBe(80);
    expect(result.overallScore).toBe(78);
    expect(result.ci95[0]).toBeLessThanOrEqual(result.overallScore);
    expect(result.ci95[1]).toBeGreaterThanOrEqual(result.overallScore);
    expect(result.agreementLevel).toBe("high");
    expect(result.warnings).toEqual([]);
  });

  it("trims min/max judge scores when agreement is moderate or high and judge count >= 3", () => {
    const engine = new ScoringEngine();

    const result = engine.score([
      {
        judgeId: "j1",
        dimensions: {
          functionalCompleteness: 70,
          codeQuality: 70,
          logicAccuracy: 70,
          security: 70,
          engineeringPractice: 70
        }
      },
      {
        judgeId: "j2",
        dimensions: {
          functionalCompleteness: 80,
          codeQuality: 80,
          logicAccuracy: 80,
          security: 80,
          engineeringPractice: 80
        }
      },
      {
        judgeId: "j3",
        dimensions: {
          functionalCompleteness: 81,
          codeQuality: 81,
          logicAccuracy: 81,
          security: 81,
          engineeringPractice: 81
        }
      },
      {
        judgeId: "j4",
        dimensions: {
          functionalCompleteness: 82,
          codeQuality: 82,
          logicAccuracy: 82,
          security: 82,
          engineeringPractice: 82
        }
      },
      {
        judgeId: "j5",
        dimensions: {
          functionalCompleteness: 90,
          codeQuality: 90,
          logicAccuracy: 90,
          security: 90,
          engineeringPractice: 90
        }
      }
    ]);

    expect(result.dimensionScores.functionalCompleteness).toBe(81);
    expect(result.overallScore).toBe(81);
  });

  it("emits warnings for low-agreement dimensions", () => {
    const engine = new ScoringEngine();

    const result = engine.score([
      {
        judgeId: "j1",
        dimensions: {
          functionalCompleteness: 80,
          codeQuality: 80,
          logicAccuracy: 80,
          security: 0,
          engineeringPractice: 80
        }
      },
      {
        judgeId: "j2",
        dimensions: {
          functionalCompleteness: 80,
          codeQuality: 80,
          logicAccuracy: 80,
          security: 50,
          engineeringPractice: 80
        }
      },
      {
        judgeId: "j3",
        dimensions: {
          functionalCompleteness: 80,
          codeQuality: 80,
          logicAccuracy: 80,
          security: 100,
          engineeringPractice: 80
        }
      }
    ]);

    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toContain("security");
  });
});

import { describe, expect, it } from "vitest";
import { calculateIja } from "./evaluation-panel.js";

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
});

import { describe, expect, it } from "vitest";
import { calibrateComplexity } from "./adaptive-calibration.js";

describe("calibrateComplexity", () => {
  it("raises complexity for strong history", () => {
    const result = calibrateComplexity([
      { score: 90, complexity: "C2" },
      { score: 92, complexity: "C2" }
    ]);
    expect(result.recommendedComplexity).toBe("C3");
  });

  it("lowers complexity for weak history", () => {
    const result = calibrateComplexity([
      { score: 40, complexity: "C3" },
      { score: 55, complexity: "C3" }
    ]);
    expect(result.recommendedComplexity).toBe("C2");
  });
});

import { describe, expect, it } from "vitest";
import { parseHashRoute, toHash } from "./route-helpers.js";
import { DIMENSIONS, safeScore } from "./viz-utils.js";

describe("viz utils", () => {
  it("clamps invalid and out-of-range scores", () => {
    expect(safeScore(undefined)).toBe(0);
    expect(safeScore(Number.NaN)).toBe(0);
    expect(safeScore(-1)).toBe(0);
    expect(safeScore(42)).toBe(42);
    expect(safeScore(150)).toBe(100);
  });

  it("keeps five score dimensions", () => {
    expect(DIMENSIONS).toHaveLength(5);
    expect(DIMENSIONS.map((item) => item.key)).toEqual([
      "functionalCompleteness",
      "codeQuality",
      "logicAccuracy",
      "security",
      "engineeringPractice"
    ]);
  });
});

describe("route helpers", () => {
  it("parses report and history hash routes", () => {
    expect(parseHashRoute("#/report/openai%2Fgpt-4o-mini/run-1")).toEqual({
      page: "report",
      model: "openai/gpt-4o-mini",
      runId: "run-1"
    });

    expect(parseHashRoute("#/history?model=openai%2Fgpt-4o-mini")).toEqual({
      page: "history",
      model: "openai/gpt-4o-mini"
    });
  });

  it("serializes hash routes", () => {
    expect(toHash({ page: "overview" })).toBe("#/");
    expect(toHash({ page: "live", model: "openai/gpt-4o-mini", runId: "run-2" })).toBe(
      "#/live/openai%2Fgpt-4o-mini/run-2"
    );
  });
});

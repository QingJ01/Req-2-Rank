import { describe, expect, it } from "vitest";
import { parseHashRoute, safeScore, toHash } from "./App";

describe("web-ui route helpers", () => {
  it("parses report and history routes", () => {
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

describe("safeScore", () => {
  it("clamps invalid and out-of-range values", () => {
    expect(safeScore(undefined)).toBe(0);
    expect(safeScore(-10)).toBe(0);
    expect(safeScore(42)).toBe(42);
    expect(safeScore(150)).toBe(100);
  });
});

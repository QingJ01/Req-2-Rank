import { describe, expect, it } from "vitest";
import { isActivePath, pickLang } from "../i18n.js";
import { parseHashRoute, toHash } from "./route-helpers.js";
import { DIMENSION_KEYS, getDimensions, safeScore, statusLabel } from "./viz-utils.js";

describe("viz utils", () => {
  it("clamps invalid and out-of-range scores", () => {
    expect(safeScore(undefined)).toBe(0);
    expect(safeScore(Number.NaN)).toBe(0);
    expect(safeScore(-1)).toBe(0);
    expect(safeScore(42)).toBe(42);
    expect(safeScore(150)).toBe(100);
  });

  it("keeps five score dimensions", () => {
    expect(DIMENSION_KEYS).toHaveLength(5);
    expect(DIMENSION_KEYS).toEqual([
      "functionalCompleteness",
      "codeQuality",
      "logicAccuracy",
      "security",
      "engineeringPractice"
    ]);
    expect(getDimensions("zh")[0]?.label).toBe("功能完成度");
    expect(getDimensions("en")[0]?.label).toBe("Functional");
  });

  it("supports localized status labels", () => {
    expect(statusLabel("verified", "zh")).toBe("已验证");
    expect(statusLabel("verified", "en")).toBe("verified");
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

describe("language helpers", () => {
  it("prefers query language over stored language", () => {
    expect(pickLang("en", "zh")).toBe("en");
    expect(pickLang("zh", "en")).toBe("zh");
  });

  it("falls back to stored language when query missing", () => {
    expect(pickLang(undefined, "en")).toBe("en");
    expect(pickLang(null, "zh")).toBe("zh");
  });

  it("defaults to zh for invalid language values", () => {
    expect(pickLang(undefined, "fr")).toBe("zh");
    expect(pickLang("de", "en")).toBe("en");
  });
});

describe("path helpers", () => {
  it("matches active path with trailing slash normalization", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/workbench", "/workbench")).toBe(true);
    expect(isActivePath("/workbench/", "/workbench")).toBe(true);
  });

  it("does not mark unrelated path as active", () => {
    expect(isActivePath("/workbench", "/")).toBe(false);
    expect(isActivePath("/", "/workbench")).toBe(false);
    expect(isActivePath("/model/openai%2Fgpt-4o-mini", "/workbench")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseOutputMode, resolveReportOutputMode } from "./output-mode.js";

describe("output-mode helpers", () => {
  it("returns default mode when value is undefined", () => {
    const mode = parseOutputMode(undefined, {
      defaultMode: "text",
      allowed: ["text", "json"],
      flagName: "--output"
    });

    expect(mode).toBe("text");
  });

  it("returns provided mode when allowed", () => {
    const mode = parseOutputMode("json", {
      defaultMode: "text",
      allowed: ["text", "json"],
      flagName: "--output"
    });

    expect(mode).toBe("json");
  });

  it("throws for unsupported mode", () => {
    expect(() =>
      parseOutputMode("yaml", {
        defaultMode: "text",
        allowed: ["text", "json"],
        flagName: "--output"
      })
    ).toThrow("Invalid --output value: yaml");
  });

  it("maps report markdown flag to output mode", () => {
    expect(resolveReportOutputMode(false)).toBe("text");
    expect(resolveReportOutputMode(true)).toBe("markdown");
  });
});

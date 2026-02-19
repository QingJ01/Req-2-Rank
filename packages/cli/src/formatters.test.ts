import { describe, expect, it } from "vitest";
import { RunRecord } from "@req2rank/core";
import {
  formatHistoryJson,
  formatHistoryText,
  formatLeaderboardJson,
  formatLeaderboardTable,
  formatLeaderboardText,
  formatReportJson,
  formatReportMarkdownCompact,
  formatReportMarkdown,
  formatReportTextCompact,
  formatReportText
} from "./formatters.js";

const sampleRun: RunRecord = {
  id: "run-123",
  createdAt: "2026-01-01T00:00:00.000Z",
  targetProvider: "openai",
  targetModel: "gpt-4o-mini",
  complexity: "C1",
  rounds: 1,
  requirementTitle: "demo",
  overallScore: 88,
  ci95: [86, 90] as [number, number],
  agreementLevel: "high" as const,
  dimensionScores: {
    functionalCompleteness: 88,
    codeQuality: 87,
    logicAccuracy: 89,
    security: 86,
    engineeringPractice: 90
  }
};

describe("cli formatters", () => {
  it("formats report text and markdown", () => {
    const text = formatReportText(sampleRun);
    const markdown = formatReportMarkdown(sampleRun);

    expect(text).toContain("Overall score: 88");
    expect(text).toContain("CI95: [86, 90]");
    expect(markdown).toContain("# Req2Rank Report");
    expect(markdown).toContain("## Dimension Scores");
  });

  it("formats compact report text and markdown", () => {
    const text = formatReportTextCompact(sampleRun);
    const markdown = formatReportMarkdownCompact(sampleRun);

    expect(text).toContain("Compact Report");
    expect(markdown).toContain("# Compact Report");
  });

  it("formats report json", () => {
    const json = formatReportJson(sampleRun);
    const parsed = JSON.parse(json) as { runId: string; overallScore: number };

    expect(parsed.runId).toBe("run-123");
    expect(parsed.overallScore).toBe(88);
  });

  it("formats history text/json", () => {
    const runs = [sampleRun];
    const text = formatHistoryText(runs);
    const json = formatHistoryJson(runs);

    expect(text).toContain("Run count: 1");
    expect(text).toContain("run-123");
    expect(JSON.parse(json)).toHaveLength(1);
  });

  it("formats leaderboard text/table/json", () => {
    const entries = [
      { rank: 1, model: "openai/gpt-4o-mini", score: 91.2 },
      { rank: 2, model: "anthropic/claude-sonnet", score: 89.4 }
    ];

    expect(formatLeaderboardText(entries)).toContain("1. openai/gpt-4o-mini - 91.2");
    expect(formatLeaderboardTable(entries)).toContain("Rank | Model | Score");
    expect(JSON.parse(formatLeaderboardJson(entries))).toHaveLength(2);
  });
});

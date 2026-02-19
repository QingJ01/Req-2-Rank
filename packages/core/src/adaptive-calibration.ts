import { Complexity } from "./types.js";

export interface CalibrationInput {
  score: number;
  complexity: Complexity;
}

export interface CalibrationResult {
  recommendedComplexity: Complexity;
  reason: string;
}

const ORDER: Complexity[] = ["C1", "C2", "C3", "C4"];

export function calibrateComplexity(history: CalibrationInput[]): CalibrationResult {
  if (history.length === 0) {
    return {
      recommendedComplexity: "C2",
      reason: "No historical data; start from C2 baseline."
    };
  }

  const avg = history.reduce((sum, run) => sum + run.score, 0) / history.length;
  const latest = history[history.length - 1]?.complexity ?? "C2";
  const latestIndex = ORDER.indexOf(latest);

  if (avg >= 88 && latestIndex < ORDER.length - 1) {
    const next = ORDER[latestIndex + 1];
    return {
      recommendedComplexity: next,
      reason: `Average score ${avg.toFixed(1)} is high; increase to ${next}.`
    };
  }

  if (avg <= 60 && latestIndex > 0) {
    const previous = ORDER[latestIndex - 1];
    return {
      recommendedComplexity: previous,
      reason: `Average score ${avg.toFixed(1)} is low; reduce to ${previous}.`
    };
  }

  return {
    recommendedComplexity: latest,
    reason: `Average score ${avg.toFixed(1)} supports keeping ${latest}.`
  };
}

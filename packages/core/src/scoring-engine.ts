import { DimensionScoreMap, EvaluationResult, ScoreDimension } from "./evaluation-panel.js";

export type DimensionWeightMap = Record<ScoreDimension, number>;

export interface ScoreResult {
  overallScore: number;
  dimensionScores: DimensionScoreMap;
  ci95: [number, number];
  agreementLevel: "high" | "moderate" | "low";
  warnings: string[];
}

const DEFAULT_WEIGHTS: DimensionWeightMap = {
  functionalCompleteness: 0.3,
  codeQuality: 0.25,
  logicAccuracy: 0.25,
  security: 0.1,
  engineeringPractice: 0.1
};

const DIMENSIONS: ScoreDimension[] = [
  "functionalCompleteness",
  "codeQuality",
  "logicAccuracy",
  "security",
  "engineeringPractice"
];

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateStdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function classifyAgreement(stdDev: number): "high" | "moderate" | "low" {
  if (stdDev <= 8) {
    return "high";
  }

  if (stdDev <= 15) {
    return "moderate";
  }

  return "low";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function trimMinMax(values: number[]): number[] {
  if (values.length < 3) {
    return values;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  return sorted.slice(1, -1);
}

export class ScoringEngine {
  private readonly weights: DimensionWeightMap;

  constructor(weights: DimensionWeightMap = DEFAULT_WEIGHTS) {
    this.weights = weights;
  }

  score(results: EvaluationResult[]): ScoreResult {
    if (results.length === 0) {
      return {
        overallScore: 0,
        dimensionScores: {
          functionalCompleteness: 0,
          codeQuality: 0,
          logicAccuracy: 0,
          security: 0,
          engineeringPractice: 0
        },
        ci95: [0, 0],
        agreementLevel: "low",
        warnings: []
      };
    }

    const perDimensionStats = DIMENSIONS.map((dimension) => {
      const values = results.map((result) => result.dimensions[dimension]);
      const stdDev = calculateStdDev(values);
      return {
        dimension,
        values,
        stdDev,
        agreement: classifyAgreement(stdDev)
      };
    });

    const overallStdDev = average(perDimensionStats.map((item) => item.stdDev));
    const agreementLevel = classifyAgreement(overallStdDev);
    const enableTrimmedMean = results.length >= 3 && agreementLevel !== "low";

    const warnings = perDimensionStats
      .filter((item) => item.agreement === "low")
      .map((item) => `${item.dimension} dimension has low agreement (sigma=${roundToOneDecimal(item.stdDev)})`);

    const dimensionScores = DIMENSIONS.reduce((accumulator, dimension) => {
      const stat = perDimensionStats.find((item) => item.dimension === dimension);
      const values = stat ? stat.values : [];
      const scoresForMean = enableTrimmedMean ? trimMinMax(values) : values;
      return {
        ...accumulator,
        [dimension]: roundToOneDecimal(average(scoresForMean))
      };
    }, {} as DimensionScoreMap);

    const overallScore = roundToOneDecimal(
      DIMENSIONS.reduce((sum, dimension) => sum + dimensionScores[dimension] * this.weights[dimension], 0)
    );

    const perJudgeOverallScores = results.map((result) =>
      DIMENSIONS.reduce((sum, dimension) => sum + result.dimensions[dimension] * this.weights[dimension], 0)
    );
    const judgeScoresForCi = enableTrimmedMean ? trimMinMax(perJudgeOverallScores) : perJudgeOverallScores;
    const stdDev = calculateStdDev(judgeScoresForCi);
    const margin = judgeScoresForCi.length > 1 ? 1.96 * (stdDev / Math.sqrt(judgeScoresForCi.length)) : 0;
    const ci95: [number, number] = [roundToOneDecimal(overallScore - margin), roundToOneDecimal(overallScore + margin)];

    return {
      overallScore,
      dimensionScores,
      ci95,
      agreementLevel,
      warnings
    };
  }
}

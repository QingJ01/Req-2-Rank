import { ExecutionResult } from "./execution-engine.js";
import { ProjectRequirement } from "./types.js";

export type ScoreDimension =
  | "functionalCompleteness"
  | "codeQuality"
  | "logicAccuracy"
  | "security"
  | "engineeringPractice";

export type DimensionScoreMap = Record<ScoreDimension, number>;

export interface EvaluationResult {
  judgeId: string;
  dimensions: DimensionScoreMap;
}

export interface EvaluationPanelOutput {
  results: EvaluationResult[];
  ija: number;
}

export interface JudgeConfig {
  provider: string;
  model: string;
  weight: number;
}

const BASE_DIMENSIONS: DimensionScoreMap = {
  functionalCompleteness: 75,
  codeQuality: 75,
  logicAccuracy: 75,
  security: 75,
  engineeringPractice: 75
};

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

function calculateStdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function calculateIja(results: EvaluationResult[]): number {
  if (results.length <= 1) {
    return 1;
  }

  const overallScores = results.map((result) => {
    const values = Object.values(result.dimensions);
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  });
  const stdDev = calculateStdDev(overallScores);
  const normalized = 1 - Math.min(stdDev / 25, 1);
  return Math.round(normalized * 1000) / 1000;
}

export class EvaluationPanel {
  async evaluate(
    requirement: ProjectRequirement,
    execution: ExecutionResult,
    judges: JudgeConfig[]
  ): Promise<EvaluationResult[]> {
    const requirementsFactor = requirement.functionalRequirements.length;
    const executionFactor = execution.code.length % 6;

    return judges.map((judge, index) => {
      const offset = requirementsFactor + executionFactor + index;
      return {
        judgeId: `${judge.provider}/${judge.model}`,
        dimensions: {
          functionalCompleteness: clampScore(BASE_DIMENSIONS.functionalCompleteness + offset),
          codeQuality: clampScore(BASE_DIMENSIONS.codeQuality + offset - 1),
          logicAccuracy: clampScore(BASE_DIMENSIONS.logicAccuracy + offset + 1),
          security: clampScore(BASE_DIMENSIONS.security + offset - 2),
          engineeringPractice: clampScore(BASE_DIMENSIONS.engineeringPractice + offset)
        }
      };
    });
  }

  async evaluateWithIja(
    requirement: ProjectRequirement,
    execution: ExecutionResult,
    judges: JudgeConfig[]
  ): Promise<EvaluationPanelOutput> {
    const results = await this.evaluate(requirement, execution, judges);
    return {
      results,
      ija: calculateIja(results)
    };
  }
}

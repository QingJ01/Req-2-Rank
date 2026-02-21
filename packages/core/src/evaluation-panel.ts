import { ExecutionResult } from "./execution-engine.js";
import { LLMProvider } from "./providers/base.js";
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
  droppedJudges: string[];
}

export interface JudgeConfig {
  provider: string;
  model: string;
  weight: number;
}

function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // continue
  }

  const fenced = raw.match(/```json\r?\n([\s\S]*?)```/i);
  if (!fenced) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fenced[1]) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function toDimensionScoreMap(raw: string): DimensionScoreMap | undefined {
  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return undefined;
  }

  const pick = (key: ScoreDimension): number | undefined => {
    const value = parsed?.[key];
    return typeof value === "number" ? clampScore(value) : undefined;
  };

  const functionalCompleteness = pick("functionalCompleteness");
  const codeQuality = pick("codeQuality");
  const logicAccuracy = pick("logicAccuracy");
  const security = pick("security");
  const engineeringPractice = pick("engineeringPractice");

  if (
    functionalCompleteness === undefined ||
    codeQuality === undefined ||
    logicAccuracy === undefined ||
    security === undefined ||
    engineeringPractice === undefined
  ) {
    return undefined;
  }

  return {
    functionalCompleteness,
    codeQuality,
    logicAccuracy,
    security,
    engineeringPractice
  };
}

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
  private latestDroppedJudges: string[] = [];

  private async collectEvaluations(
    requirement: ProjectRequirement,
    execution: ExecutionResult,
    judges: JudgeConfig[],
    providerForJudge: (judge: JudgeConfig) => LLMProvider
  ): Promise<{ results: EvaluationResult[]; droppedJudges: string[] }> {
    const settled = await Promise.allSettled(
      judges.map(async (judge) => {
        const provider = providerForJudge(judge);
        const prompt = [
          "You are an expert software code reviewer.",
          "Score this code against the requirement on exactly five dimensions (0-100):",
          "functionalCompleteness, codeQuality, logicAccuracy, security, engineeringPractice.",
          "Return strict JSON only.",
          "",
          `Requirement title: ${requirement.title}`,
          `Requirement description: ${requirement.description}`,
          "Functional requirements:",
          ...requirement.functionalRequirements.map((item) => `- ${item.id}: ${item.description}`),
          "Constraints:",
          ...requirement.constraints.map((item) => `- ${item}`),
          "Code under review:",
          "```",
          execution.code,
          "```"
        ].join("\n");

        const response = await provider.chat({
          model: judge.model,
          temperature: 0,
          maxTokens: 1_024,
          responseFormat: "json",
          messages: [
            {
              role: "system",
              content: "You are strict and objective. Output only valid JSON."
            },
            {
              role: "user",
              content: prompt
            }
          ]
        });

        const dimensions = toDimensionScoreMap(response.content);
        if (!dimensions) {
          throw new Error("invalid judge response");
        }

        return {
          judgeId: `${judge.provider}/${judge.model}`,
          dimensions
        };
      })
    );

    const results: EvaluationResult[] = [];
    const droppedJudges: string[] = [];
    for (let index = 0; index < settled.length; index += 1) {
      const result = settled[index];
      const judge = judges[index];
      const judgeId = `${judge.provider}/${judge.model}`;
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        droppedJudges.push(judgeId);
      }
    }

    return { results, droppedJudges };
  }

  async evaluate(
    requirement: ProjectRequirement,
    execution: ExecutionResult,
    judges: JudgeConfig[],
    providerForJudge: (judge: JudgeConfig) => LLMProvider
  ): Promise<EvaluationResult[]> {
    const { results, droppedJudges } = await this.collectEvaluations(requirement, execution, judges, providerForJudge);
    this.latestDroppedJudges = droppedJudges;
    if (results.length === 0) {
      throw new Error(`all judges failed (${droppedJudges.join(", ")})`);
    }
    return results;
  }

  async evaluateWithIja(
    requirement: ProjectRequirement,
    execution: ExecutionResult,
    judges: JudgeConfig[],
    providerForJudge: (judge: JudgeConfig) => LLMProvider
  ): Promise<EvaluationPanelOutput> {
    this.latestDroppedJudges = [];
    const results = await this.evaluate(requirement, execution, judges, providerForJudge);

    return {
      results,
      ija: calculateIja(results),
      droppedJudges: this.latestDroppedJudges
    };
  }
}

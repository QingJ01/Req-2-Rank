import { Req2RankConfig, RunRecord } from "./config.js";
import { EvaluationPanel, JudgeConfig } from "./evaluation-panel.js";
import { ExecutionEngine } from "./execution-engine.js";
import { LLMProvider } from "./providers/base.js";
import { createProvider } from "./providers/index.js";
import { RequirementGenerator } from "./requirement-generator.js";
import { ScoringEngine } from "./scoring-engine.js";

const C12 = ["C1", "C2"] as const;
const C1234 = ["C1", "C2", "C3", "C4"] as const;

function resolveComplexity(value: Req2RankConfig["test"]["complexity"], now: Date): "C1" | "C2" | "C3" | "C4" {
  if (value === "mixed") {
    const index = now.getTime() % C1234.length;
    return C1234[index];
  }

  return value;
}

function buildRunId(now: Date): string {
  const base = now.toISOString().replace(/[T:.Z-]/g, "").slice(0, 14);
  return `run-${base}`;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function calculateStdDev(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function classifyAgreementFromIja(ija: number): "high" | "moderate" | "low" {
  if (ija >= 0.8) {
    return "high";
  }
  if (ija >= 0.5) {
    return "moderate";
  }
  return "low";
}

export interface PipelineRunInput {
  config: Req2RankConfig;
  now?: Date;
  checkpoint?: {
    key: string;
    store: PipelineCheckpointStore;
  };
}

export interface PipelineRoundSnapshot {
  index: number;
  overallScore: number;
  dimensionScores: Record<string, number>;
  ija: number;
  requirementTitle: string;
}

export interface PipelineCheckpoint {
  version: 1;
  createdAt: string;
  totalRounds: number;
  completedRounds: PipelineRoundSnapshot[];
}

export interface PipelineCheckpointStore {
  load(key: string): Promise<PipelineCheckpoint | undefined>;
  save(key: string, checkpoint: PipelineCheckpoint): Promise<void>;
  clear(key: string): Promise<void>;
}

export class PipelineOrchestrator {
  private readonly generator: RequirementGenerator;
  private readonly executionEngine: ExecutionEngine;
  private readonly evaluationPanel: EvaluationPanel;
  private readonly scoringEngine: ScoringEngine;
  private readonly providerFactory: typeof createProvider;
  private readonly isDefaultProviderFactory: boolean;

  constructor(
    generator = new RequirementGenerator(),
    executionEngine = new ExecutionEngine(),
    evaluationPanel = new EvaluationPanel(),
    scoringEngine = new ScoringEngine(),
    providerFactory: typeof createProvider = createProvider
  ) {
    this.generator = generator;
    this.executionEngine = executionEngine;
    this.evaluationPanel = evaluationPanel;
    this.scoringEngine = scoringEngine;
    this.providerFactory = providerFactory;
    this.isDefaultProviderFactory = providerFactory === createProvider;
  }

  private resolveProvider(config: {
    provider: string;
    apiKey?: string;
    baseUrl?: string | null;
  }): LLMProvider {
    const apiKey = config.apiKey ?? "";
    if (!apiKey && this.isDefaultProviderFactory) {
      throw new Error(`Missing API key for provider ${config.provider}`);
    }

    if (
      this.isDefaultProviderFactory &&
      config.provider !== "openai" &&
      config.provider !== "anthropic" &&
      config.provider !== "google" &&
      config.provider !== "custom"
    ) {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }

    return this.providerFactory({
      provider: (config.provider as "openai" | "anthropic" | "google" | "custom") ?? "openai",
      apiKey: apiKey || "stub-key",
      baseUrl: config.baseUrl ?? undefined
    });
  }

  async run(input: PipelineRunInput): Promise<RunRecord> {
    const now = input.now ?? new Date();
    const rounds = input.config.test.rounds;
    const concurrency = Math.min(Math.max(input.config.test.concurrency, 1), rounds);

    let loadedCheckpoint: PipelineCheckpoint | undefined;
    if (input.checkpoint) {
      loadedCheckpoint = await input.checkpoint.store.load(input.checkpoint.key);
      if (loadedCheckpoint && loadedCheckpoint.totalRounds !== rounds) {
        throw new Error("checkpoint round count mismatch");
      }
    }

    const systemProvider = this.resolveProvider({
      provider: input.config.systemModel.provider,
      apiKey: input.config.systemModel.apiKey
    });
    const targetProvider = this.resolveProvider({
      provider: input.config.target.provider,
      apiKey: input.config.target.apiKey,
      baseUrl: input.config.target.baseUrl
    });

    const judges = input.config.judges as JudgeConfig[];
    const judgeProviderById = new Map<string, LLMProvider>();
    for (const judge of judges) {
      const providerKey = `${judge.provider}/${judge.model}`;
      if (!judgeProviderById.has(providerKey)) {
        judgeProviderById.set(
          providerKey,
          this.resolveProvider({ provider: judge.provider, apiKey: (judge as { apiKey?: string }).apiKey })
        );
      }
    }

    const roundScores: Array<{
      overallScore: number;
      dimensionScores: Record<string, number>;
      ija: number;
      requirementTitle: string;
    }> = new Array(rounds);

    for (const snapshot of loadedCheckpoint?.completedRounds ?? []) {
      if (snapshot.index >= 0 && snapshot.index < rounds) {
        roundScores[snapshot.index] = {
          overallScore: snapshot.overallScore,
          dimensionScores: snapshot.dimensionScores,
          ija: snapshot.ija,
          requirementTitle: snapshot.requirementTitle
        };
      }
    }

    const pendingRoundIndexes: number[] = [];
    for (let index = 0; index < rounds; index += 1) {
      if (!roundScores[index]) {
        pendingRoundIndexes.push(index);
      }
    }

    const buildCheckpoint = (): PipelineCheckpoint => ({
      version: 1,
      createdAt: now.toISOString(),
      totalRounds: rounds,
      completedRounds: roundScores
        .map((item, index) => (item ? { index, ...item } : undefined))
        .filter((item): item is PipelineRoundSnapshot => Boolean(item))
    });

    let roundCursor = 0;
    const worker = async (): Promise<void> => {
      while (true) {
        const pendingIndex = roundCursor;
        roundCursor += 1;
        if (pendingIndex >= pendingRoundIndexes.length) {
          return;
        }

        const index = pendingRoundIndexes[pendingIndex];

        const roundTime = new Date(now.getTime() + index * 1000);
        const roundComplexity = resolveComplexity(input.config.test.complexity, roundTime);

        const requirement = await this.generator.generate(
          {
            skills: ["api-design", "error-handling"],
            complexity: roundComplexity,
            domain: "generic",
            scenario: "pipeline-eval",
            techStack: ["typescript"],
            seed: `${now.toISOString()}-${roundComplexity}-${index}`
          },
          {
            provider: systemProvider,
            model: input.config.systemModel.model
          }
        );

        const execution = await this.executionEngine.execute(
          requirement,
          {
            provider: input.config.target.provider,
            model: input.config.target.model
          },
          { provider: targetProvider }
        );

        const evaluationOutput = await this.evaluationPanel.evaluateWithIja(requirement, execution, judges, (judge) => {
          const key = `${judge.provider}/${judge.model}`;
          const provider = judgeProviderById.get(key);
          if (!provider) {
            throw new Error(`Missing judge provider: ${key}`);
          }
          return provider;
        });

        const scoreResult = this.scoringEngine.score(evaluationOutput.results);
        roundScores[index] = {
          overallScore: scoreResult.overallScore,
          dimensionScores: scoreResult.dimensionScores,
          ija: evaluationOutput.ija,
          requirementTitle: requirement.title
        };

        if (input.checkpoint) {
          await input.checkpoint.store.save(input.checkpoint.key, buildCheckpoint());
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, async () => worker()));

    if (input.checkpoint) {
      await input.checkpoint.store.clear(input.checkpoint.key);
    }

    const overallScores = roundScores.map((item) => item.overallScore);
    const aggregateScore = roundToOneDecimal(average(overallScores));
    const stdDev = calculateStdDev(overallScores);
    const margin = overallScores.length > 1 ? 1.96 * (stdDev / Math.sqrt(overallScores.length)) : 0;

    const dimensionNames = Object.keys(roundScores[0]?.dimensionScores ?? {});
    const aggregateDimensions = dimensionNames.reduce<Record<string, number>>((accumulator, name) => {
      accumulator[name] = roundToOneDecimal(average(roundScores.map((item) => item.dimensionScores[name] ?? 0)));
      return accumulator;
    }, {});

    const aggregateIja = average(roundScores.map((item) => item.ija));

    return {
      id: buildRunId(now),
      createdAt: now.toISOString(),
      targetProvider: input.config.target.provider,
      targetModel: input.config.target.model,
      complexity: input.config.test.complexity,
      rounds: input.config.test.rounds,
      requirementTitle: roundScores[roundScores.length - 1]?.requirementTitle ?? "",
      overallScore: aggregateScore,
      dimensionScores: aggregateDimensions,
      ci95: [roundToOneDecimal(aggregateScore - margin), roundToOneDecimal(aggregateScore + margin)],
      agreementLevel: classifyAgreementFromIja(aggregateIja),
      ijaScore: roundToOneDecimal(aggregateIja)
    };
  }
}

export { C12, C1234 };

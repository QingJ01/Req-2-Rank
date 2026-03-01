import { Req2RankConfig, RunRecord } from "./config.js";
import { EvaluationPanel, JudgeConfig } from "./evaluation-panel.js";
import { ExecutionEngine } from "./execution-engine.js";
import { createEvidenceChain } from "./evidence-chain.js";
import { LLMProvider } from "./providers/base.js";
import { createProvider } from "./providers/index.js";
import { RequirementGenerator } from "./requirement-generator.js";
import { ScoringEngine } from "./scoring-engine.js";
import { randomUUID } from "node:crypto";

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
  const suffix = randomUUID().replace(/-/g, "").slice(0, 8);
  return `run-${base}-${suffix}`;
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

const DIMENSION_KEYS = [
  "functionalCompleteness",
  "codeQuality",
  "logicAccuracy",
  "security",
  "engineeringPractice"
] as const;

type DimensionKey = (typeof DIMENSION_KEYS)[number];

function zeroDimensionScores(): Record<DimensionKey, number> {
  return {
    functionalCompleteness: 0,
    codeQuality: 0,
    logicAccuracy: 0,
    security: 0,
    engineeringPractice: 0
  };
}

function isTimeoutLikeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("request failed after retry attempts")
  );
}

function isRoundRecoverableError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return isTimeoutLikeError(error) || error.name === "SandboxValidationError";
}

function coerceIsoTime(value: Date): string {
  return value.toISOString();
}

export interface PipelineRunInput {
  config: Req2RankConfig;
  now?: Date;
  onProgress?: (event: PipelineProgressEvent) => void | Promise<void>;
  sandbox?: {
    enabled: boolean;
    strict?: boolean;
    runner: (code: string, context: { roundIndex: number; requirementTitle: string; language: string }) => Promise<void>;
  };
  checkpoint?: {
    key: string;
    store: PipelineCheckpointStore;
  };
}

export interface PipelineProgressEvent {
  timestamp: string;
  roundIndex: number;
  totalRounds: number;
  phase: "generate" | "execute" | "evaluate" | "score";
  state: "started" | "completed" | "failed";
  message?: string;
}

export interface PipelineRoundSnapshot {
  index: number;
  overallScore: number;
  dimensionScores: Record<string, number>;
  ija: number;
  requirementTitle: string;
  requirementText?: string;
  codeSubmission?: string;
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
    apiVersion?: string;
  }): LLMProvider {
    const apiKey = config.apiKey ?? "";
    if (!apiKey && this.isDefaultProviderFactory) {
      throw new Error(`Missing API key for provider ${config.provider}`);
    }

    if (
      this.isDefaultProviderFactory &&
      config.provider !== "openai" &&
      config.provider !== "openai-response" &&
      config.provider !== "anthropic" &&
      config.provider !== "gemini" &&
      config.provider !== "azure-openai" &&
      config.provider !== "newapi" &&
      config.provider !== "google" &&
      config.provider !== "custom"
    ) {
      throw new Error(`Unsupported provider: ${config.provider}`);
    }

    return this.providerFactory({
      provider:
        (config.provider as
          | "openai"
          | "openai-response"
          | "anthropic"
          | "gemini"
          | "azure-openai"
          | "newapi"
          | "google"
          | "custom") ?? "openai",
      apiKey,
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
      apiKey: input.config.systemModel.apiKey,
      baseUrl: input.config.systemModel.baseUrl
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
          this.resolveProvider({
            provider: judge.provider,
            apiKey: (judge as { apiKey?: string }).apiKey,
            baseUrl: (judge as { baseUrl?: string | null }).baseUrl
          })
        );
      }
    }

    const roundScores: Array<{
      overallScore: number;
      dimensionScores: Record<string, number>;
      ija: number;
      requirementTitle: string;
      requirementText: string;
      codeSubmission: string;
      phaseTimes: Record<"generate" | "execute" | "evaluate" | "score", { startedAt: string; completedAt: string }>;
    }> = new Array(rounds);

    const checkpointCreatedAt = loadedCheckpoint?.createdAt ?? now.toISOString();
    for (const snapshot of loadedCheckpoint?.completedRounds ?? []) {
      if (snapshot.index >= 0 && snapshot.index < rounds) {
        roundScores[snapshot.index] = {
          overallScore: snapshot.overallScore,
          dimensionScores: snapshot.dimensionScores,
          ija: snapshot.ija,
          requirementTitle: snapshot.requirementTitle,
          requirementText: snapshot.requirementText ?? snapshot.requirementTitle,
          codeSubmission: snapshot.codeSubmission ?? "code-unavailable",
          phaseTimes: {
            generate: { startedAt: checkpointCreatedAt, completedAt: checkpointCreatedAt },
            execute: { startedAt: checkpointCreatedAt, completedAt: checkpointCreatedAt },
            evaluate: { startedAt: checkpointCreatedAt, completedAt: checkpointCreatedAt },
            score: { startedAt: checkpointCreatedAt, completedAt: checkpointCreatedAt }
          }
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
      completedRounds: roundScores.reduce<PipelineRoundSnapshot[]>((accumulator, item, index) => {
        if (!item) {
          return accumulator;
        }

        accumulator.push({
          index,
          overallScore: item.overallScore,
          dimensionScores: item.dimensionScores,
          ija: item.ija,
          requirementTitle: item.requirementTitle,
          requirementText: item.requirementText,
          codeSubmission: item.codeSubmission
        });
        return accumulator;
      }, [])
    });

    const emitProgress = async (event: PipelineProgressEvent): Promise<void> => {
      if (!input.onProgress) {
        return;
      }
      await input.onProgress(event);
    };

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

        let requirementTitle = `Round ${index + 1}`;
        let requirementText = "";
        let codeSubmission = "";
        let requirement: Awaited<ReturnType<RequirementGenerator["generate"]>> | undefined;

        const phaseTimes: Record<"generate" | "execute" | "evaluate" | "score", { startedAt: string; completedAt: string }> = {
          generate: { startedAt: "", completedAt: "" },
          execute: { startedAt: "", completedAt: "" },
          evaluate: { startedAt: "", completedAt: "" },
          score: { startedAt: "", completedAt: "" }
        };

        try {
          const generateStart = new Date();
          await emitProgress({
            timestamp: coerceIsoTime(generateStart),
            roundIndex: index,
            totalRounds: rounds,
            phase: "generate",
            state: "started"
          });
          phaseTimes.generate.startedAt = coerceIsoTime(generateStart);
          requirement = await this.generator.generate(
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
          phaseTimes.generate.completedAt = coerceIsoTime(new Date());
          await emitProgress({
            timestamp: phaseTimes.generate.completedAt,
            roundIndex: index,
            totalRounds: rounds,
            phase: "generate",
            state: "completed"
          });

          requirementTitle = requirement.title;
          requirementText = JSON.stringify(requirement, null, 2);

          const executeStart = new Date();
          await emitProgress({
            timestamp: coerceIsoTime(executeStart),
            roundIndex: index,
            totalRounds: rounds,
            phase: "execute",
            state: "started"
          });
          phaseTimes.execute.startedAt = coerceIsoTime(executeStart);
          const execution = await this.executionEngine.execute(
            requirement,
            {
              provider: input.config.target.provider,
              model: input.config.target.model
            },
            { provider: targetProvider }
          );
          phaseTimes.execute.completedAt = coerceIsoTime(new Date());
          await emitProgress({
            timestamp: phaseTimes.execute.completedAt,
            roundIndex: index,
            totalRounds: rounds,
            phase: "execute",
            state: "completed"
          });
          codeSubmission = execution.code;

          if (input.sandbox?.enabled) {
            try {
              await input.sandbox.runner(codeSubmission, {
                roundIndex: index,
                requirementTitle,
                language: execution.language
              });
            } catch (sandboxError) {
              const error = new Error(sandboxError instanceof Error ? sandboxError.message : String(sandboxError));
              error.name = "SandboxValidationError";
              if (input.sandbox.strict ?? true) {
                throw error;
              }
              await emitProgress({
                timestamp: coerceIsoTime(new Date()),
                roundIndex: index,
                totalRounds: rounds,
                phase: "execute",
                state: "failed",
                message: `sandbox warning: ${error.message}`
              });
            }
          }

          const evaluateStart = new Date();
          await emitProgress({
            timestamp: coerceIsoTime(evaluateStart),
            roundIndex: index,
            totalRounds: rounds,
            phase: "evaluate",
            state: "started"
          });
          phaseTimes.evaluate.startedAt = coerceIsoTime(evaluateStart);
          const evaluationOutput = await this.evaluationPanel.evaluateWithIja(requirement, execution, judges, (judge) => {
            const key = `${judge.provider}/${judge.model}`;
            const provider = judgeProviderById.get(key);
            if (!provider) {
              throw new Error(`Missing judge provider: ${key}`);
            }
            return provider;
          });
          phaseTimes.evaluate.completedAt = coerceIsoTime(new Date());
          await emitProgress({
            timestamp: phaseTimes.evaluate.completedAt,
            roundIndex: index,
            totalRounds: rounds,
            phase: "evaluate",
            state: "completed"
          });

          const scoreStart = new Date();
          await emitProgress({
            timestamp: coerceIsoTime(scoreStart),
            roundIndex: index,
            totalRounds: rounds,
            phase: "score",
            state: "started"
          });
          phaseTimes.score.startedAt = coerceIsoTime(scoreStart);
          const scoreResult = this.scoringEngine.score(evaluationOutput.results);
          phaseTimes.score.completedAt = coerceIsoTime(new Date());
          await emitProgress({
            timestamp: phaseTimes.score.completedAt,
            roundIndex: index,
            totalRounds: rounds,
            phase: "score",
            state: "completed"
          });
          roundScores[index] = {
            overallScore: scoreResult.overallScore,
            dimensionScores: scoreResult.dimensionScores,
            ija: evaluationOutput.ija,
            requirementTitle,
            requirementText,
            codeSubmission,
            phaseTimes
          };
        } catch (error) {
          await emitProgress({
            timestamp: coerceIsoTime(new Date()),
            roundIndex: index,
            totalRounds: rounds,
            phase: !phaseTimes.generate.completedAt
              ? "generate"
              : !phaseTimes.execute.completedAt
                ? "execute"
                : !phaseTimes.evaluate.completedAt
                  ? "evaluate"
                  : "score",
            state: "failed",
            message: error instanceof Error ? error.message : String(error)
          });

          if (!isRoundRecoverableError(error)) {
            throw error;
          }

          const timeoutAt = coerceIsoTime(new Date());
          for (const phase of ["generate", "execute", "evaluate", "score"] as const) {
            if (!phaseTimes[phase].startedAt) {
              phaseTimes[phase].startedAt = timeoutAt;
            }
            if (!phaseTimes[phase].completedAt) {
              phaseTimes[phase].completedAt = timeoutAt;
            }
          }

          roundScores[index] = {
            overallScore: 0,
            dimensionScores: zeroDimensionScores(),
            ija: 0,
            requirementTitle: `${requirementTitle} (failed)`,
            requirementText: requirementText || "Round failed due to timeout or sandbox validation.",
            codeSubmission: codeSubmission || "failed",
            phaseTimes
          };
        }

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

    const requirementTitle = roundScores.map((item) => item.requirementTitle).join(" | ");

    const phaseWindows = {
      generate: {
        startedAt: roundScores.map((item) => item.phaseTimes.generate.startedAt).sort()[0],
        completedAt: roundScores.map((item) => item.phaseTimes.generate.completedAt).sort().at(-1) ?? now.toISOString(),
        model: `${input.config.systemModel.provider}/${input.config.systemModel.model}`
      },
      execute: {
        startedAt: roundScores.map((item) => item.phaseTimes.execute.startedAt).sort()[0],
        completedAt: roundScores.map((item) => item.phaseTimes.execute.completedAt).sort().at(-1) ?? now.toISOString(),
        model: `${input.config.target.provider}/${input.config.target.model}`
      },
      evaluate: {
        startedAt: roundScores.map((item) => item.phaseTimes.evaluate.startedAt).sort()[0],
        completedAt: roundScores.map((item) => item.phaseTimes.evaluate.completedAt).sort().at(-1) ?? now.toISOString(),
        model: judges.map((judge) => `${judge.provider}/${judge.model}`).join(",")
      },
      score: {
        startedAt: roundScores.map((item) => item.phaseTimes.score.startedAt).sort()[0],
        completedAt: roundScores.map((item) => item.phaseTimes.score.completedAt).sort().at(-1) ?? now.toISOString(),
        model: "scoring-engine"
      }
    };

    const timeline = [
      {
        phase: "generate" as const,
        ...phaseWindows.generate
      },
      {
        phase: "execute" as const,
        ...phaseWindows.execute,
        startedAt: phaseWindows.execute.startedAt < phaseWindows.generate.completedAt ? phaseWindows.generate.completedAt : phaseWindows.execute.startedAt
      },
      {
        phase: "evaluate" as const,
        ...phaseWindows.evaluate,
        startedAt: phaseWindows.evaluate.startedAt < phaseWindows.execute.completedAt ? phaseWindows.execute.completedAt : phaseWindows.evaluate.startedAt
      },
      {
        phase: "score" as const,
        ...phaseWindows.score,
        startedAt: phaseWindows.score.startedAt < phaseWindows.evaluate.completedAt ? phaseWindows.evaluate.completedAt : phaseWindows.score.startedAt
      }
    ].map((item, index, all) => {
      if (index > 0 && item.completedAt < all[index - 1].completedAt) {
        return {
          ...item,
          completedAt: all[index - 1].completedAt
        };
      }
      return item;
    }) as Array<{ phase: "generate" | "execute" | "evaluate" | "score"; startedAt: string; completedAt: string; model: string }>;

    const samples = roundScores.slice(0, Math.min(2, roundScores.length)).map((item, index) => ({
      roundIndex: index,
      requirement: item.requirementText,
      codeSubmission: item.codeSubmission
    }));

    const evidenceChain = createEvidenceChain({
      timeline,
      samples,
      judgeModels: judges.map((judge) => `${judge.provider}/${judge.model}`)
    });

    return {
      id: buildRunId(now),
      createdAt: now.toISOString(),
      targetProvider: input.config.target.provider,
      targetModel: input.config.target.model,
      complexity: input.config.test.complexity,
      rounds: input.config.test.rounds,
      requirementTitle,
      overallScore: aggregateScore,
      dimensionScores: aggregateDimensions,
      ci95: [roundToOneDecimal(aggregateScore - margin), roundToOneDecimal(aggregateScore + margin)],
      agreementLevel: classifyAgreementFromIja(aggregateIja),
      ijaScore: roundToOneDecimal(aggregateIja),
      evidenceChain
    };
  }
}

export { C12, C1234 };

import { describe, expect, it } from "vitest";
import { ProjectRequirement } from "./types.js";
import {
  EvaluationPanel,
  EvaluationResult,
  ExecutionEngine,
  ExecutionResult,
  LLMProvider,
  PipelineCheckpoint,
  PipelineCheckpointStore,
  PipelineOrchestrator,
  ScoringEngine,
  ScoreResult
} from "./index.js";

class FakeExecutionEngine extends ExecutionEngine {
  called = 0;

  override async execute(): Promise<ExecutionResult> {
    this.called += 1;
    return {
      code: "export const ok = true;",
      language: "typescript",
      timeoutMs: 30_000,
      maxTokens: 4_096
    };
  }
}

class FakeEvaluationPanel extends EvaluationPanel {
  called = 0;

  override async evaluate(requirement: ProjectRequirement, execution: ExecutionResult): Promise<EvaluationResult[]> {
    this.called += 1;
    expect(requirement.title.length).toBeGreaterThan(0);
    expect(execution.code).toContain("ok");
    return [
      {
        judgeId: "judge-1",
        dimensions: {
          functionalCompleteness: 88,
          codeQuality: 84,
          logicAccuracy: 90,
          security: 80,
          engineeringPractice: 85
        }
      }
    ];
  }
}

class FakeScoringEngine extends ScoringEngine {
  called = 0;

  override score(results: EvaluationResult[]): ScoreResult {
    this.called += 1;
    expect(results.length).toBe(1);
    return {
      overallScore: 87,
      dimensionScores: {
        functionalCompleteness: 88,
        codeQuality: 84,
        logicAccuracy: 90,
        security: 80,
        engineeringPractice: 85
      },
      ci95: [84, 90],
      agreementLevel: "high",
      warnings: []
    };
  }
}

class FakeProvider implements LLMProvider {
  id = "openai";
  name = "Fake";

  async chat(): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number }; latencyMs: number }> {
    return {
      content: JSON.stringify({
        title: "Req",
        description: "desc",
        functionalRequirements: [
          {
            id: "FR-1",
            description: "Do thing",
            acceptanceCriteria: "Done",
            priority: "must"
          },
          {
            id: "FR-2",
            description: "Handle error",
            acceptanceCriteria: "Errors handled",
            priority: "must"
          }
        ],
        constraints: ["Use TS"],
        expectedDeliverables: ["source"],
        evaluationGuidance: {
          keyDifferentiators: ["quality"],
          commonPitfalls: ["bugs"],
          edgeCases: ["empty"]
        },
        selfReviewPassed: true
      }),
      usage: { promptTokens: 1, completionTokens: 1 },
      latencyMs: 1
    };
  }
}

class InMemoryCheckpointStore implements PipelineCheckpointStore {
  private checkpoints = new Map<string, PipelineCheckpoint>();

  async load(key: string): Promise<PipelineCheckpoint | undefined> {
    return this.checkpoints.get(key);
  }

  async save(key: string, checkpoint: PipelineCheckpoint): Promise<void> {
    this.checkpoints.set(key, checkpoint);
  }

  async clear(key: string): Promise<void> {
    this.checkpoints.delete(key);
  }
}

class FailingExecutionEngine extends ExecutionEngine {
  called = 0;

  override async execute(): Promise<ExecutionResult> {
    this.called += 1;
    if (this.called === 2) {
      throw new Error("synthetic crash");
    }

    return {
      code: "export const ok = true;",
      language: "typescript",
      timeoutMs: 30_000,
      maxTokens: 4_096
    };
  }
}

describe("PipelineOrchestrator stage handoff", () => {
  it("passes execute -> evaluate -> score and returns dimension scores", async () => {
    const execution = new FakeExecutionEngine();
    const evaluation = new FakeEvaluationPanel();
    const scoring = new FakeScoringEngine();
    const provider = new FakeProvider();
    const providerFactory = () => provider;

    const orchestrator = new PipelineOrchestrator(undefined, execution, evaluation, scoring, providerFactory);
    const run = await orchestrator.run({
      config: {
        target: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
        systemModel: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
        judges: [{ provider: "openai", model: "gpt-4o", apiKey: "k", weight: 1 }],
        test: { complexity: "C1", rounds: 1, concurrency: 1 }
      }
    });

    expect(execution.called).toBe(1);
    expect(evaluation.called).toBe(1);
    expect(scoring.called).toBe(1);
    expect(run.overallScore).toBe(87);
    expect(run.dimensionScores.logicAccuracy).toBe(90);
    expect(run.ci95[0]).toBe(87);
    expect(run.agreementLevel).toBe("high");
  });

  it("honors rounds configuration and aggregates multiple rounds", async () => {
    const execution = new FakeExecutionEngine();
    const evaluation = new FakeEvaluationPanel();
    const scoring = new FakeScoringEngine();
    const provider = new FakeProvider();
    const providerFactory = () => provider;

    const orchestrator = new PipelineOrchestrator(undefined, execution, evaluation, scoring, providerFactory);
    const run = await orchestrator.run({
      config: {
        target: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
        systemModel: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
        judges: [{ provider: "openai", model: "gpt-4o", apiKey: "k", weight: 1 }],
        test: { complexity: "C1", rounds: 3, concurrency: 2 }
      }
    });

    expect(execution.called).toBe(3);
    expect(evaluation.called).toBe(3);
    expect(scoring.called).toBe(3);
    expect(run.rounds).toBe(3);
    expect(run.overallScore).toBe(87);
  });

  it("supports checkpoint resume after mid-run failure", async () => {
    const checkpointStore = new InMemoryCheckpointStore();
    const checkpointKey = "pipeline-checkpoint-1";
    const crashingExecution = new FailingExecutionEngine();
    const evaluation = new FakeEvaluationPanel();
    const scoring = new FakeScoringEngine();
    const provider = new FakeProvider();
    const providerFactory = () => provider;

    const firstOrchestrator = new PipelineOrchestrator(undefined, crashingExecution, evaluation, scoring, providerFactory);
    await expect(
      firstOrchestrator.run({
        config: {
          target: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
          systemModel: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
          judges: [{ provider: "openai", model: "gpt-4o", apiKey: "k", weight: 1 }],
          test: { complexity: "C1", rounds: 3, concurrency: 1 }
        },
        checkpoint: {
          key: checkpointKey,
          store: checkpointStore
        }
      })
    ).rejects.toThrow("synthetic crash");

    const savedCheckpoint = await checkpointStore.load(checkpointKey);
    expect(savedCheckpoint).toBeDefined();
    expect(savedCheckpoint?.completedRounds.length).toBe(1);

    const resumedExecution = new FakeExecutionEngine();
    const secondOrchestrator = new PipelineOrchestrator(undefined, resumedExecution, evaluation, scoring, providerFactory);
    const resumedRun = await secondOrchestrator.run({
      config: {
        target: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
        systemModel: { provider: "openai", model: "gpt-4o-mini", apiKey: "k" },
        judges: [{ provider: "openai", model: "gpt-4o", apiKey: "k", weight: 1 }],
        test: { complexity: "C1", rounds: 3, concurrency: 1 }
      },
      checkpoint: {
        key: checkpointKey,
        store: checkpointStore
      }
    });

    expect(resumedExecution.called).toBe(2);
    expect(resumedRun.rounds).toBe(3);
    expect(resumedRun.overallScore).toBe(87);
    expect(await checkpointStore.load(checkpointKey)).toBeUndefined();
  });
});

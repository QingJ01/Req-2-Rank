import { describe, expect, it } from "vitest";
import { ProjectRequirement } from "./types.js";
import {
  EvaluationPanel,
  EvaluationResult,
  ExecutionEngine,
  ExecutionResult,
  PipelineOrchestrator,
  ScoringEngine,
  ScoreResult
} from "./index.js";

class FakeExecutionEngine extends ExecutionEngine {
  called = false;

  override async execute(): Promise<ExecutionResult> {
    this.called = true;
    return {
      code: "export const ok = true;",
      language: "typescript",
      timeoutMs: 30_000,
      maxTokens: 4_096
    };
  }
}

class FakeEvaluationPanel extends EvaluationPanel {
  called = false;

  override async evaluate(requirement: ProjectRequirement, execution: ExecutionResult): Promise<EvaluationResult[]> {
    this.called = true;
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
  called = false;

  override score(results: EvaluationResult[]): ScoreResult {
    this.called = true;
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

describe("PipelineOrchestrator stage handoff", () => {
  it("passes execute -> evaluate -> score and returns dimension scores", async () => {
    const execution = new FakeExecutionEngine();
    const evaluation = new FakeEvaluationPanel();
    const scoring = new FakeScoringEngine();

    const orchestrator = new PipelineOrchestrator(undefined, execution, evaluation, scoring);
    const run = await orchestrator.run({
      config: {
        target: { provider: "openai", model: "gpt-4o-mini" },
        systemModel: { provider: "anthropic", model: "claude-sonnet-4-20250514" },
        judges: [{ provider: "openai", model: "gpt-4o", weight: 1 }],
        test: { complexity: "C1", rounds: 1, concurrency: 1 }
      }
    });

    expect(execution.called).toBe(true);
    expect(evaluation.called).toBe(true);
    expect(scoring.called).toBe(true);
    expect(run.overallScore).toBe(87);
    expect(run.dimensionScores.logicAccuracy).toBe(90);
    expect(run.ci95[0]).toBe(84);
    expect(run.agreementLevel).toBe("high");
  });
});

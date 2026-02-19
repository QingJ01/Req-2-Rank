import { Req2RankConfig, RunRecord } from "./config.js";
import { EvaluationPanel, JudgeConfig } from "./evaluation-panel.js";
import { ExecutionEngine } from "./execution-engine.js";
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

export interface PipelineRunInput {
  config: Req2RankConfig;
  now?: Date;
}

export class PipelineOrchestrator {
  private readonly generator: RequirementGenerator;
  private readonly executionEngine: ExecutionEngine;
  private readonly evaluationPanel: EvaluationPanel;
  private readonly scoringEngine: ScoringEngine;

  constructor(
    generator = new RequirementGenerator(),
    executionEngine = new ExecutionEngine(),
    evaluationPanel = new EvaluationPanel(),
    scoringEngine = new ScoringEngine()
  ) {
    this.generator = generator;
    this.executionEngine = executionEngine;
    this.evaluationPanel = evaluationPanel;
    this.scoringEngine = scoringEngine;
  }

  async run(input: PipelineRunInput): Promise<RunRecord> {
    const now = input.now ?? new Date();
    const complexity = resolveComplexity(input.config.test.complexity, now);
    const requirement = this.generator.generate({
      skills: ["api-design", "error-handling"],
      complexity,
      domain: "generic",
      scenario: "pipeline-eval",
      techStack: ["typescript"],
      seed: `${now.toISOString()}-${complexity}`
    });

    const execution = await this.executionEngine.execute(requirement, {
      provider: input.config.target.provider,
      model: input.config.target.model
    });

    const evaluationOutput = await this.evaluationPanel.evaluateWithIja(
      requirement,
      execution,
      input.config.judges as JudgeConfig[]
    );

    const scoreResult = this.scoringEngine.score(evaluationOutput.results);

    return {
      id: buildRunId(now),
      createdAt: now.toISOString(),
      targetProvider: input.config.target.provider,
      targetModel: input.config.target.model,
      complexity: input.config.test.complexity,
      rounds: input.config.test.rounds,
      requirementTitle: requirement.title,
      overallScore: scoreResult.overallScore,
      dimensionScores: scoreResult.dimensionScores,
      ci95: scoreResult.ci95,
      agreementLevel: scoreResult.agreementLevel,
      ijaScore: evaluationOutput.ija
    };
  }
}

export { C12, C1234 };

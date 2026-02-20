import { RunRecord } from "./config.js";
import { createEvidenceChain } from "./evidence-chain.js";
import { SubmissionRequest } from "./submitter-types.js";

export interface BuildSubmissionPayloadInput {
  run: RunRecord;
  nonce: string;
  now?: Date;
}

export function buildSubmissionPayload(input: BuildSubmissionPayloadInput): SubmissionRequest {
  const now = input.now ?? new Date();
  const fallbackEvidenceChain = createEvidenceChain({
    requirement: input.run.requirementTitle,
    codeSubmission: "code-unavailable",
    judgeModels: []
  });

  return {
    runId: input.run.id,
    nonce: input.nonce,
    targetProvider: input.run.targetProvider,
    targetModel: input.run.targetModel,
    complexity: input.run.complexity,
    overallScore: input.run.overallScore,
    ci95: input.run.ci95,
    agreementLevel: input.run.agreementLevel,
    dimensionScores: input.run.dimensionScores,
    submittedAt: now.toISOString(),
    evidenceChain: input.run.evidenceChain ?? fallbackEvidenceChain
  };
}

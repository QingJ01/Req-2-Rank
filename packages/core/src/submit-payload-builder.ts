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

  return {
    runId: input.run.id,
    nonce: input.nonce,
    targetProvider: input.run.targetProvider,
    targetModel: input.run.targetModel,
    overallScore: input.run.overallScore,
    ci95: input.run.ci95,
    agreementLevel: input.run.agreementLevel,
    dimensionScores: input.run.dimensionScores,
    submittedAt: now.toISOString(),
    evidenceChain: createEvidenceChain({
      requirement: input.run.requirementTitle,
      codeSubmission: "placeholder-code-submission",
      judgeModels: []
    })
  };
}

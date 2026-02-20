import { platform } from "node:os";
import { EvidenceChain } from "./submitter-types.js";

export interface CreateEvidenceChainInput {
  requirement?: string;
  codeSubmission?: string;
  judgeModels?: string[];
  timeline?: EvidenceChain["timeline"];
  samples?: EvidenceChain["samples"];
  now?: Date;
}

export function createEvidenceChain(input: CreateEvidenceChainInput): EvidenceChain {
  const now = input.now ?? new Date();
  const startedAt = new Date(now.getTime() - 1_500).toISOString();
  const completedAt = now.toISOString();

  const timeline: EvidenceChain["timeline"] =
    input.timeline && input.timeline.length > 0
      ? input.timeline
      : [
          { phase: "generate", startedAt, completedAt, model: "system-generator" },
          { phase: "execute", startedAt, completedAt, model: "target-model" },
          { phase: "evaluate", startedAt, completedAt, model: (input.judgeModels ?? []).join(",") || "judge-model" },
          { phase: "score", startedAt, completedAt, model: "scoring-engine" }
        ];

  const samples: EvidenceChain["samples"] =
    input.samples && input.samples.length > 0
      ? input.samples
      : [
          {
            roundIndex: 0,
            requirement: input.requirement ?? "requirement-unavailable",
            codeSubmission: input.codeSubmission ?? "code-unavailable"
          }
        ];

  return {
    timeline,
    samples,
    environment: {
      os: platform(),
      nodeVersion: process.version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };
}

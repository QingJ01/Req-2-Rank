import { platform } from "node:os";
import { EvidenceChain } from "./submitter-types.js";

export interface CreateEvidenceChainInput {
  requirement: string;
  codeSubmission: string;
  judgeModels: string[];
  now?: Date;
}

export function createEvidenceChain(input: CreateEvidenceChainInput): EvidenceChain {
  const now = input.now ?? new Date();
  const startedAt = new Date(now.getTime() - 1500).toISOString();
  const completedAt = now.toISOString();

  const timeline: EvidenceChain["timeline"] = [
    { phase: "generate", startedAt, completedAt, model: "system-generator" },
    { phase: "execute", startedAt, completedAt, model: "target-model" },
    { phase: "evaluate", startedAt, completedAt, model: input.judgeModels.join(",") || "judge-model" },
    { phase: "score", startedAt, completedAt, model: "scoring-engine" }
  ];

  return {
    timeline,
    samples: [
      {
        roundIndex: 0,
        requirement: input.requirement,
        codeSubmission: input.codeSubmission
      }
    ],
    environment: {
      os: platform(),
      nodeVersion: process.version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
  };
}

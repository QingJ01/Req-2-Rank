import { createHash } from "node:crypto";
import { Req2RankConfig } from "./config.js";

export function createPipelineCheckpointKey(scope: "run" | "compare", config: Req2RankConfig): string {
  const signaturePayload = {
    target: {
      provider: config.target.provider,
      model: config.target.model,
      baseUrl: config.target.baseUrl ?? null
    },
    systemModel: {
      provider: config.systemModel.provider,
      model: config.systemModel.model
    },
    judges: config.judges.map((judge) => ({
      provider: judge.provider,
      model: judge.model,
      weight: judge.weight
    })),
    test: {
      complexity: config.test.complexity,
      rounds: config.test.rounds,
      concurrency: config.test.concurrency
    }
  };

  const hash = createHash("sha256").update(JSON.stringify(signaturePayload)).digest("hex").slice(0, 16);
  return `${scope}:${config.target.provider}/${config.target.model}:${hash}`;
}

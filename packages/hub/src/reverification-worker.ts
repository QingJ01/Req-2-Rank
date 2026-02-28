import { SubmissionStore } from "./routes";
import { PipelineOrchestrator, Req2RankConfig } from "@req2rank/core";

export interface ReverificationWorkerResult {
  processed: number;
  verified: number;
  disputed: number;
}

interface ReplayResult {
  overallScore: number;
  ijaScore?: number;
}

type ReplayRunner = (submission: Awaited<ReturnType<SubmissionStore["getSubmission"]>>) => Promise<ReplayResult>;

function parseProviderModel(model: string): { provider: string; model: string } {
  const [provider, modelName] = model.split("/");
  if (!provider || !modelName) {
    throw new Error(`invalid submission model identifier: ${model}`);
  }
  return { provider, model: modelName };
}

function normalizeComplexity(value: string): Req2RankConfig["test"]["complexity"] {
  if (value === "C1" || value === "C2" || value === "C3" || value === "C4") {
    return value;
  }
  return "C3";
}

function buildReverificationConfig(submissionModel: string, submissionComplexity: string): Req2RankConfig {
  const target = parseProviderModel(submissionModel);
  const toProvider = (value: string): Req2RankConfig["target"]["provider"] => value as Req2RankConfig["target"]["provider"];

  const targetApiKey = process.env.R2R_REVERIFY_TARGET_API_KEY;
  const systemProvider = process.env.R2R_REVERIFY_SYSTEM_PROVIDER;
  const systemModel = process.env.R2R_REVERIFY_SYSTEM_MODEL;
  const systemApiKey = process.env.R2R_REVERIFY_SYSTEM_API_KEY;
  const judgeProvider = process.env.R2R_REVERIFY_JUDGE_PROVIDER;
  const judgeModel = process.env.R2R_REVERIFY_JUDGE_MODEL;
  const judgeApiKey = process.env.R2R_REVERIFY_JUDGE_API_KEY;

  if (!targetApiKey || !systemProvider || !systemModel || !systemApiKey || !judgeProvider || !judgeModel || !judgeApiKey) {
    throw new Error("reverification LLM config is incomplete");
  }

  return {
    target: {
      provider: toProvider(target.provider),
      model: target.model,
      apiKey: targetApiKey,
      baseUrl: process.env.R2R_REVERIFY_TARGET_BASE_URL ?? undefined
    },
    systemModel: {
      provider: toProvider(systemProvider),
      model: systemModel,
      apiKey: systemApiKey
    },
    judges: [
      {
        provider: toProvider(judgeProvider),
        model: judgeModel,
        apiKey: judgeApiKey,
        weight: 1
      }
    ],
    test: {
      complexity: normalizeComplexity(submissionComplexity),
      rounds: 1,
      concurrency: 1
    },
    hub: {
      enabled: false
    }
  };
}

async function runReverificationReplay(submission: Awaited<ReturnType<SubmissionStore["getSubmission"]>>): Promise<ReplayResult> {
  if (!submission) {
    throw new Error("missing submission for replay");
  }

  const orchestrator = new PipelineOrchestrator();
  const run = await orchestrator.run({
    config: buildReverificationConfig(submission.model, submission.complexity)
  });

  return {
    overallScore: run.overallScore,
    ijaScore: run.ijaScore
  };
}

export async function processQueuedReverificationJobs(
  store: SubmissionStore,
  options: { maxJobs?: number; replayRunner?: ReplayRunner; maxScoreDrift?: number } = {}
): Promise<ReverificationWorkerResult> {
  const maxJobs = options.maxJobs ?? 20;
  const replayRunner = options.replayRunner ?? runReverificationReplay;
  const maxScoreDrift = options.maxScoreDrift ?? 12;
  const jobs = await store.listQueuedReverificationJobs(maxJobs);

  let verified = 0;
  let disputed = 0;
  for (const job of jobs) {
    const submission = await store.getSubmission(job.runId);
    if (!submission) {
      await store.resolveReverificationJob(job.runId, "disputed");
      disputed += 1;
      continue;
    }

    try {
      const replay = await replayRunner(submission);
      const scoreDrift = Math.abs(replay.overallScore - submission.score);
      const lowAgreement = typeof replay.ijaScore === "number" && replay.ijaScore < 0.45;
      const nextStatus = scoreDrift > maxScoreDrift || lowAgreement ? "disputed" : "verified";
      await store.resolveReverificationJob(job.runId, nextStatus);

      if (nextStatus === "verified") {
        verified += 1;
      } else {
        disputed += 1;
      }
    } catch {
      await store.resolveReverificationJob(job.runId, "disputed");
      disputed += 1;
    }
  }

  return {
    processed: jobs.length,
    verified,
    disputed
  };
}

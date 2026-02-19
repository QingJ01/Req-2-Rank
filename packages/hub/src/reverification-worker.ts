import { SubmissionStore } from "./routes.js";

export interface ReverificationWorkerResult {
  processed: number;
  verified: number;
  disputed: number;
}

export async function processQueuedReverificationJobs(
  store: SubmissionStore,
  options: { maxJobs?: number } = {}
): Promise<ReverificationWorkerResult> {
  const maxJobs = options.maxJobs ?? 20;
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

    const ciWidth = submission.ci95[1] - submission.ci95[0];
    const suspicious = submission.score >= 95 && ciWidth > 8;
    const nextStatus = suspicious ? "disputed" : "verified";
    await store.resolveReverificationJob(job.runId, nextStatus);

    if (nextStatus === "verified") {
      verified += 1;
    } else {
      disputed += 1;
    }
  }

  return {
    processed: jobs.length,
    verified,
    disputed
  };
}

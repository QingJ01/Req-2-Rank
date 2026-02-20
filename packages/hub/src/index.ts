export interface LeaderboardSubmission {
  id: string;
  targetModel: string;
  overallScore: number;
  submittedAt: string;
}

export function normalizeSubmission(input: LeaderboardSubmission): LeaderboardSubmission {
  return {
    ...input,
    targetModel: input.targetModel.trim(),
    submittedAt: new Date(input.submittedAt).toISOString()
  };
}

export * from "./routes";
export * from "./lib/auth";

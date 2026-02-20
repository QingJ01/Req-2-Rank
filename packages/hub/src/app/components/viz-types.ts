export type VerificationStatus = "pending" | "verified" | "disputed";

export type ScoreDimension =
  | "functionalCompleteness"
  | "codeQuality"
  | "logicAccuracy"
  | "security"
  | "engineeringPractice";

export type SubmissionDetailView = {
  runId: string;
  model: string;
  score: number;
  ci95: [number, number];
  agreementLevel: "high" | "moderate" | "low";
  dimensionScores: Record<string, number>;
  submittedAt: string;
  verificationStatus: VerificationStatus;
  evidenceChain?: {
    timeline: Array<{
      phase: "generate" | "execute" | "evaluate" | "score";
      startedAt: string;
      completedAt: string;
      model: string;
    }>;
    samples: Array<{
      roundIndex: number;
      requirement: string;
      codeSubmission: string;
    }>;
    environment: {
      os: string;
      nodeVersion: string;
      timezone: string;
    };
  };
};

export type LeaderboardRowView = {
  rank: number;
  model: string;
  score: number;
  ci95?: [number, number];
  verificationStatus?: VerificationStatus;
};

export type LiveProgressSnapshot = {
  status: "idle" | "running" | "completed" | "failed";
  updatedAt: string;
  runId?: string;
  model?: string;
  error?: string;
  events: Array<{
    timestamp: string;
    roundIndex: number;
    totalRounds: number;
    phase: "generate" | "execute" | "evaluate" | "score";
    state: "started" | "completed" | "failed";
    message?: string;
  }>;
};

export interface SubmissionRequest {
  runId: string;
  nonce: string;
  targetProvider: string;
  targetModel: string;
  overallScore: number;
  ci95?: [number, number];
  agreementLevel?: "high" | "moderate" | "low";
  dimensionScores?: Record<string, number>;
  submittedAt: string;
  evidenceChain: EvidenceChain;
}

export interface NonceResponse {
  nonce: string;
  expiresAt: string;
}

export interface SubmissionResponse {
  status: "pending" | "accepted" | "rejected";
  message: string;
}

export interface LeaderboardEntry {
  rank: number;
  model: string;
  score: number;
  ci95?: [number, number];
  verificationStatus?: "pending" | "verified" | "disputed";
}

export interface LeaderboardQuery {
  limit?: number | string;
  offset?: number | string;
  sort?: "asc" | "desc" | string;
}

export interface EvidenceChain {
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
}

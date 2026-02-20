export interface SubmissionRequest {
  runId: string;
  nonce: string;
  targetProvider: string;
  targetModel: string;
  complexity?: "C1" | "C2" | "C3" | "C4" | "mixed";
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
  complexity?: "C1" | "C2" | "C3" | "C4" | "mixed" | string;
  dimension?:
    | "functionalCompleteness"
    | "codeQuality"
    | "logicAccuracy"
    | "security"
    | "engineeringPractice"
    | string;
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

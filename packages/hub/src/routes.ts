import {
  LeaderboardEntry,
  LeaderboardQuery,
  NonceResponse,
  SubmissionRequest,
  SubmissionResponse,
  parseLeaderboardQuery
} from "@req2rank/core";
import { LeaderboardAggregationStrategy, resolveLeaderboardStrategy } from "./lib/leaderboard-strategy";
import { randomBytes } from "node:crypto";

export interface NonceRequest {
  userId: string;
}

export interface ExtendedLeaderboardQuery extends LeaderboardQuery {
  strategy?: string;
}

export interface LeaderboardRequest extends ExtendedLeaderboardQuery {}

export interface FlagSubmissionRequest {
  runId: string;
}

export interface ReverificationResponse {
  status: "queued";
  runId: string;
  reason: "top-score" | "flagged";
}

export interface SubmissionDetail {
  runId: string;
  model: string;
  score: number;
  ci95: [number, number];
  agreementLevel: "high" | "moderate" | "low";
  dimensionScores: Record<string, number>;
  evidenceChain?: SubmissionRequest["evidenceChain"];
  submittedAt: string;
  verificationStatus: "pending" | "verified" | "disputed";
}

export interface ReverificationJobDetail {
  runId: string;
  reason: "top-score" | "flagged";
  queuedAt: string;
}

export interface CalibrationRecord {
  id: string;
  source: string;
  actorId?: string;
  recommendedComplexity: "C1" | "C2" | "C3" | "C4";
  reason: string;
  averageScore: number;
  sampleSize: number;
  createdAt: string;
}

export interface RouteContext<TBody> {
  actorId: string;
  authToken?: string;
  body: TBody;
}

export type ValidationHook = (actorId: string, authToken?: string) => Promise<void>;

export interface RouteSuccessEnvelope<T> {
  ok: true;
  status: number;
  data: T;
}

export interface RouteErrorEnvelope {
  ok: false;
  status: number;
  error: {
    code: "VALIDATION_ERROR" | "AUTH_ERROR" | "INTERNAL_ERROR";
    message: string;
  };
}

export type RouteEnvelope<T> = RouteSuccessEnvelope<T> | RouteErrorEnvelope;

function requireNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

interface StoredNonce {
  nonce: string;
  actorId: string;
  expiresAt: string;
  usedAt?: string;
}

interface StoredSubmission {
  runId: string;
  actorId: string;
  model: string;
  complexity: "C1" | "C2" | "C3" | "C4" | "mixed";
  score: number;
  ci95: [number, number];
  agreementLevel: "high" | "moderate" | "low";
  dimensionScores: Record<string, number>;
  evidenceChain?: SubmissionRequest["evidenceChain"];
  submittedAt: string;
  verificationStatus: "pending" | "verified" | "disputed";
}

interface ReverificationJob {
  runId: string;
  reason: "top-score" | "flagged";
  queuedAt: string;
}

interface StoredCalibration {
  id: string;
  source: string;
  actorId?: string;
  recommendedComplexity: "C1" | "C2" | "C3" | "C4";
  reason: string;
  averageScore: number;
  sampleSize: number;
  createdAt: string;
}

function aggregateModelEntries(
  submissions: StoredSubmission[],
  sort: "asc" | "desc",
  strategy: LeaderboardAggregationStrategy,
  dimension?: string,
  offset = 0,
  limit = 20
): LeaderboardEntry[] {
  const metric = (submission: StoredSubmission): number => {
    if (!dimension) {
      return submission.score;
    }
    return submission.dimensionScores[dimension] ?? 0;
  };

  const grouped = new Map<string, StoredSubmission[]>();
  for (const submission of submissions) {
    const list = grouped.get(submission.model) ?? [];
    list.push(submission);
    grouped.set(submission.model, list);
  }

  const entries = Array.from(grouped.entries()).map(([model, group]) => {
    const latest = group.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0] ?? group[0];
    const best = group.slice().sort((left, right) => metric(right) - metric(left))[0] ?? group[0];

    let score = best.score;
    let ci95: [number, number] = best.ci95;
    let verificationStatus: "pending" | "verified" | "disputed" = best.verificationStatus;
    let rankMetric = metric(best);

    if (strategy === "latest") {
      score = latest.score;
      ci95 = latest.ci95;
      verificationStatus = latest.verificationStatus;
      rankMetric = metric(latest);
    } else if (strategy === "mean") {
      score = group.reduce((sum, item) => sum + item.score, 0) / group.length;
      ci95 = [
        group.reduce((sum, item) => sum + (item.ci95?.[0] ?? item.score), 0) / group.length,
        group.reduce((sum, item) => sum + (item.ci95?.[1] ?? item.score), 0) / group.length
      ];
      rankMetric = group.reduce((sum, item) => sum + metric(item), 0) / group.length;
      const hasDisputed = group.some((item) => item.verificationStatus === "disputed");
      const hasPending = group.some((item) => item.verificationStatus === "pending");
      verificationStatus = hasDisputed ? "disputed" : hasPending ? "pending" : "verified";
    }

    return {
      model,
      score,
      ci95,
      verificationStatus,
      metric: rankMetric
    };
  });

  const sorted = entries
    .sort((left, right) => (sort === "asc" ? left.metric - right.metric : right.metric - left.metric))
    .slice(offset, offset + limit);

  return sorted.map((entry, index) => ({
    rank: offset + index + 1,
    model: entry.model,
    score: entry.score,
    ci95: entry.ci95,
    verificationStatus: entry.verificationStatus
  }));
}

export interface SubmissionStore {
  issueNonce(actorId: string): Promise<NonceResponse>;
  consumeNonce(actorId: string, nonce: string, now?: Date): Promise<void>;
  saveSubmission(payload: SubmissionRequest, actorId?: string): Promise<void>;
  countSubmissionsForActorDay(actorId: string, dayIsoDate: string): Promise<number>;
  listLeaderboard(query: ExtendedLeaderboardQuery): Promise<LeaderboardEntry[]>;
  queueReverification(runId: string, reason: "top-score" | "flagged"): Promise<ReverificationResponse>;
  hasSubmission(runId: string): Promise<boolean>;
  getSubmission(runId: string): Promise<SubmissionDetail | undefined>;
  listModelSubmissions(model: string): Promise<SubmissionDetail[]>;
  listQueuedReverificationJobs(limit?: number): Promise<ReverificationJobDetail[]>;
  resolveReverificationJob(runId: string, status: "verified" | "disputed"): Promise<void>;
  saveCalibration(record: Omit<CalibrationRecord, "id" | "createdAt">): Promise<CalibrationRecord>;
  listCalibrations(limit?: number): Promise<CalibrationRecord[]>;
}

function resolveDailySubmissionLimit(): number {
  const raw = process.env.R2R_DAILY_SUBMISSION_LIMIT;
  if (!raw) {
    return 20;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }

  return parsed;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function validateTimeline(payload: SubmissionRequest): void {
  const timeline = payload.evidenceChain.timeline;
  if (timeline.length === 0) {
    throw new Error("timeline is required");
  }

  const phaseOrder: Record<SubmissionRequest["evidenceChain"]["timeline"][number]["phase"], number> = {
    generate: 0,
    execute: 1,
    evaluate: 2,
    score: 3
  };

  let previousPhase = -1;
  let previousCompletedAt = "";
  for (const item of timeline) {
    const currentPhase = phaseOrder[item.phase];
    if (currentPhase < previousPhase) {
      throw new Error("timeline phase order is invalid");
    }

    if (item.startedAt > item.completedAt) {
      throw new Error("timeline phase duration is invalid");
    }

    if (previousCompletedAt && item.startedAt < previousCompletedAt) {
      throw new Error("timeline timestamps are not monotonic");
    }

    previousPhase = currentPhase;
    previousCompletedAt = item.completedAt;
  }
}

function validateEvidenceChainSanity(payload: SubmissionRequest): void {
  if (payload.evidenceChain.samples.length === 0) {
    throw new Error("evidence samples are required");
  }

  const seenRounds = new Set<number>();
  for (const sample of payload.evidenceChain.samples) {
    if (seenRounds.has(sample.roundIndex)) {
      throw new Error("duplicate sample roundIndex");
    }
    seenRounds.add(sample.roundIndex);

    if (sample.roundIndex < 0) {
      throw new Error("sample roundIndex must be >= 0");
    }
    requireNonEmpty(sample.requirement, "sample.requirement");
    requireNonEmpty(sample.codeSubmission, "sample.codeSubmission");
    if (sample.codeSubmission.length > 200_000) {
      throw new Error("sample.codeSubmission too large");
    }
  }

  requireNonEmpty(payload.evidenceChain.environment.os, "environment.os");
  requireNonEmpty(payload.evidenceChain.environment.nodeVersion, "environment.nodeVersion");
  requireNonEmpty(payload.evidenceChain.environment.timezone, "environment.timezone");

}

function toDetail(input: StoredSubmission): SubmissionDetail {
  return {
    runId: input.runId,
    model: input.model,
    score: input.score,
    ci95: input.ci95,
    agreementLevel: input.agreementLevel,
    dimensionScores: input.dimensionScores,
    evidenceChain: input.evidenceChain,
    submittedAt: input.submittedAt,
    verificationStatus: input.verificationStatus
  };
}

export function createSubmissionStore(): SubmissionStore {
  const nonces: StoredNonce[] = [];
  const submissions: StoredSubmission[] = [];
  const jobs: ReverificationJob[] = [];
  const calibrations: StoredCalibration[] = [];

  function activeNonceCount(actorId: string, nowIso: string): number {
    return nonces.filter((item) => item.actorId === actorId && !item.usedAt && item.expiresAt > nowIso).length;
  }

  return {
    async issueNonce(actorId: string): Promise<NonceResponse> {
      const now = new Date();
      const nowIso = now.toISOString();

      if (activeNonceCount(actorId, nowIso) >= 3) {
        throw new Error("too many active nonces");
      }

      const nonce: StoredNonce = {
        nonce: `nonce-${Date.now()}-${randomBytes(6).toString("hex")}`,
        actorId,
        expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()
      };
      nonces.push(nonce);
      return { nonce: nonce.nonce, expiresAt: nonce.expiresAt };
    },

    async consumeNonce(actorId: string, nonce: string, now = new Date()): Promise<void> {
      const target = nonces.find((item) => item.nonce === nonce);
      if (!target) {
        throw new Error("nonce not found");
      }

      if (target.actorId !== actorId) {
        throw new Error("nonce actor mismatch");
      }

      if (target.usedAt) {
        throw new Error("nonce already used");
      }

      if (target.expiresAt <= now.toISOString()) {
        throw new Error("nonce expired");
      }

      target.usedAt = now.toISOString();
    },

    async saveSubmission(payload: SubmissionRequest, actorId = "system"): Promise<void> {
      submissions.push({
        runId: payload.runId,
        actorId,
        model: `${payload.targetProvider}/${payload.targetModel}`,
        complexity: payload.complexity ?? "mixed",
        score: payload.overallScore,
        ci95: payload.ci95 ?? [payload.overallScore, payload.overallScore],
        agreementLevel: payload.agreementLevel ?? "moderate",
        dimensionScores: payload.dimensionScores ?? {},
        evidenceChain: payload.evidenceChain,
        submittedAt: payload.submittedAt,
        verificationStatus: payload.overallScore >= 90 ? "pending" : "verified"
      });

      if (payload.overallScore >= 90) {
        jobs.push({ runId: payload.runId, reason: "top-score", queuedAt: new Date().toISOString() });
      }
    },

    async countSubmissionsForActorDay(actorId: string, dayIsoDate: string): Promise<number> {
      return submissions.filter((item) => item.actorId === actorId && item.submittedAt.slice(0, 10) === dayIsoDate).length;
    },

    async listLeaderboard(query: ExtendedLeaderboardQuery): Promise<LeaderboardEntry[]> {
      const { limit, offset, sort, complexity, dimension } = parseLeaderboardQuery(query);
      const strategy = resolveLeaderboardStrategy((query as LeaderboardQuery & { strategy?: string }).strategy);
      const filtered = submissions.filter((item) => (complexity ? item.complexity === complexity : true));
      return aggregateModelEntries(filtered, sort, strategy, dimension, offset, limit);
    },

    async queueReverification(runId: string, reason: "top-score" | "flagged"): Promise<ReverificationResponse> {
      if (!submissions.some((item) => item.runId === runId)) {
        throw new Error(`submission not found: ${runId}`);
      }

      jobs.push({ runId, reason, queuedAt: new Date().toISOString() });
      const target = submissions.find((item) => item.runId === runId);
      if (target) {
        target.verificationStatus = "pending";
      }

      return {
        status: "queued",
        runId,
        reason
      };
    },

    async hasSubmission(runId: string): Promise<boolean> {
      return submissions.some((item) => item.runId === runId);
    },

    async getSubmission(runId: string): Promise<SubmissionDetail | undefined> {
      const item = submissions.find((entry) => entry.runId === runId);
      return item ? toDetail(item) : undefined;
    },

    async listModelSubmissions(model: string): Promise<SubmissionDetail[]> {
      return submissions
        .filter((entry) => entry.model === model)
        .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
        .map((entry) => toDetail(entry));
    },

    async listQueuedReverificationJobs(limit = 20): Promise<ReverificationJobDetail[]> {
      return jobs
        .slice()
        .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt))
        .slice(0, limit)
        .map((job) => ({ ...job }));
    },

    async resolveReverificationJob(runId: string, status: "verified" | "disputed"): Promise<void> {
      const target = submissions.find((item) => item.runId === runId);
      if (!target) {
        throw new Error(`submission not found: ${runId}`);
      }

      target.verificationStatus = status;
      const jobIndex = jobs.findIndex((job) => job.runId === runId);
      if (jobIndex >= 0) {
        jobs.splice(jobIndex, 1);
      }
    },

    async saveCalibration(record: Omit<CalibrationRecord, "id" | "createdAt">): Promise<CalibrationRecord> {
      const calibration: StoredCalibration = {
        ...record,
        id: `cal-${Date.now()}-${randomBytes(6).toString("hex")}`,
        createdAt: new Date().toISOString()
      };
      calibrations.push(calibration);
      return { ...calibration };
    },

    async listCalibrations(limit = 20): Promise<CalibrationRecord[]> {
      return calibrations
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, limit)
        .map((item) => ({ ...item }));
    }
  };
}

const defaultStore = createSubmissionStore();

export function createAuthValidator(expectedToken: string): ValidationHook {
  return async (_actorId: string, authToken?: string) => {
    if (!authToken || authToken !== expectedToken) {
      throw new Error("not authorized");
    }
  };
}

export async function postNonceRoute(request: NonceRequest): Promise<NonceResponse> {
  requireNonEmpty(request.userId, "userId");
  return defaultStore.issueNonce(request.userId);
}

export async function postSubmitRoute(payload: SubmissionRequest): Promise<SubmissionResponse> {
  requireNonEmpty(payload.runId, "runId");
  requireNonEmpty(payload.nonce, "nonce");
  requireNonEmpty(payload.targetProvider, "targetProvider");
  requireNonEmpty(payload.targetModel, "targetModel");

  if (payload.overallScore < 0 || payload.overallScore > 100) {
    throw new Error("overallScore must be within 0-100");
  }

  validateTimeline(payload);
  validateEvidenceChainSanity(payload);

  return {
    status: "accepted",
    message: `Submission accepted: ${payload.runId}`
  };
}

export async function postFlagSubmissionRoute(
  request: FlagSubmissionRequest,
  store: SubmissionStore
): Promise<ReverificationResponse> {
  requireNonEmpty(request.runId, "runId");
  return store.queueReverification(request.runId, "flagged");
}

export async function getLeaderboardRoute(request: LeaderboardRequest): Promise<LeaderboardEntry[]> {
  return defaultStore.listLeaderboard(request);
}

function mapError(error: unknown): RouteErrorEnvelope {
  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("authorized") || lower.includes("forbidden") || lower.includes("auth")) {
      return {
        ok: false,
        status: 401,
        error: {
          code: "AUTH_ERROR",
          message: error.message
        }
      };
    }

    return {
      ok: false,
      status: 400,
      error: {
        code: "VALIDATION_ERROR",
        message: error.message
      }
    };
  }

  return {
    ok: false,
    status: 500,
    error: {
      code: "INTERNAL_ERROR",
      message: "Unknown error"
    }
  };
}

export function createNonceHandler(validate: ValidationHook, store: SubmissionStore = defaultStore) {
  return async (context: RouteContext<NonceRequest>): Promise<RouteEnvelope<NonceResponse>> => {
    try {
      await validate(context.actorId, context.authToken);
      requireNonEmpty(context.body.userId, "userId");
      const data = await store.issueNonce(context.actorId);
      return {
        ok: true,
        status: 200,
        data
      };
    } catch (error) {
      return mapError(error);
    }
  };
}

export function createSubmitHandler(validate: ValidationHook, store: SubmissionStore = defaultStore) {
  return async (context: RouteContext<SubmissionRequest>): Promise<RouteEnvelope<SubmissionResponse>> => {
    try {
      await validate(context.actorId, context.authToken);
      const dailyLimit = resolveDailySubmissionLimit();
      const submittedToday = await store.countSubmissionsForActorDay(context.actorId, toIsoDate(new Date()));
      if (submittedToday >= dailyLimit) {
        throw new Error(`daily submission limit exceeded (${dailyLimit})`);
      }

      await store.consumeNonce(context.actorId, context.body.nonce);
      const data = await postSubmitRoute(context.body);
      await store.saveSubmission(context.body, context.actorId);
      return {
        ok: true,
        status: 200,
        data
      };
    } catch (error) {
      return mapError(error);
    }
  };
}

export function createLeaderboardHandler(validate: ValidationHook, store: SubmissionStore = defaultStore) {
  return async (context: RouteContext<LeaderboardRequest>): Promise<RouteEnvelope<LeaderboardEntry[]>> => {
    try {
      await validate(context.actorId, context.authToken);
      const data = await store.listLeaderboard(context.body);
      return {
        ok: true,
        status: 200,
        data
      };
    } catch (error) {
      return mapError(error);
    }
  };
}

export function createFlagSubmissionHandler(validate: ValidationHook, store: SubmissionStore = defaultStore) {
  return async (context: RouteContext<FlagSubmissionRequest>): Promise<RouteEnvelope<ReverificationResponse>> => {
    try {
      await validate(context.actorId, context.authToken);
      const data = await postFlagSubmissionRoute(context.body, store);
      return {
        ok: true,
        status: 200,
        data
      };
    } catch (error) {
      return mapError(error);
    }
  };
}

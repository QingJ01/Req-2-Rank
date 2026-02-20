import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { LeaderboardEntry, LeaderboardQuery, NonceResponse, SubmissionRequest, parseLeaderboardQuery } from "@req2rank/core";
import { ExtendedLeaderboardQuery, ReverificationJobDetail, SubmissionDetail, SubmissionStore } from "../../routes.js";
import { LeaderboardAggregationStrategy, resolveLeaderboardStrategy } from "../leaderboard-strategy.js";
import { calibrationSnapshotsTable, noncesTable, reverificationJobsTable, submissionsTable } from "./schema.js";

type LeaderboardRow = {
  model: string;
  score: number;
  ciLow: number;
  ciHigh: number;
  submittedAt: Date;
  dimensionScores: Record<string, number>;
  verificationStatus: "pending" | "verified" | "disputed";
};

function aggregateLeaderboardRows(
  rows: LeaderboardRow[],
  sort: "asc" | "desc",
  strategy: LeaderboardAggregationStrategy,
  dimension?: string,
  offset = 0,
  limit = 20
): LeaderboardEntry[] {
  const metric = (row: LeaderboardRow): number => {
    if (!dimension) {
      return Number(row.score);
    }
    return Number(row.dimensionScores?.[dimension] ?? 0);
  };

  const grouped = new Map<string, LeaderboardRow[]>();
  for (const row of rows) {
    const group = grouped.get(row.model) ?? [];
    group.push(row);
    grouped.set(row.model, group);
  }

  const aggregated = Array.from(grouped.entries()).map(([model, group]) => {
    const count = group.length;
    const best = group.slice().sort((left, right) => metric(right) - metric(left))[0] ?? group[0];
    const latest = group.slice().sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())[0] ?? group[0];

    let score = Number(best.score);
    let ci95: [number, number] = [Number(best.ciLow), Number(best.ciHigh)];
    let rankMetric = metric(best);
    let verificationStatus: "pending" | "verified" | "disputed" = best.verificationStatus;

    if (strategy === "latest") {
      score = Number(latest.score);
      ci95 = [Number(latest.ciLow), Number(latest.ciHigh)];
      rankMetric = metric(latest);
      verificationStatus = latest.verificationStatus;
    } else if (strategy === "mean") {
      score = group.reduce((sum, row) => sum + Number(row.score), 0) / count;
      ci95 = [
        group.reduce((sum, row) => sum + Number(row.ciLow), 0) / count,
        group.reduce((sum, row) => sum + Number(row.ciHigh), 0) / count
      ];
      rankMetric = group.reduce((sum, row) => sum + metric(row), 0) / count;
      const hasDisputed = group.some((row) => row.verificationStatus === "disputed");
      const hasPending = group.some((row) => row.verificationStatus === "pending");
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

  return aggregated
    .sort((left, right) => (sort === "asc" ? left.metric - right.metric : right.metric - left.metric))
    .slice(offset, offset + limit)
    .map((row, index) => ({
      rank: offset + index + 1,
      model: row.model,
      score: row.score,
      ci95: row.ci95,
      verificationStatus: row.verificationStatus
    }));
}

function toDetail(row: {
  runId: string;
  model: string;
  score: number;
  ciLow: number;
  ciHigh: number;
  agreementLevel: string;
  dimensionScores: unknown;
  evidenceChain: unknown;
  submittedAt: Date;
  verificationStatus: string;
}): SubmissionDetail {
  return {
    runId: row.runId,
    model: row.model,
    score: row.score,
    ci95: [row.ciLow, row.ciHigh],
    agreementLevel: row.agreementLevel as SubmissionDetail["agreementLevel"],
    dimensionScores: (row.dimensionScores as Record<string, number>) ?? {},
    evidenceChain: (row.evidenceChain as SubmissionDetail["evidenceChain"]) ?? undefined,
    submittedAt: row.submittedAt.toISOString(),
    verificationStatus: row.verificationStatus as SubmissionDetail["verificationStatus"]
  };
}

export function createDrizzleSubmissionStore(databaseUrl: string): SubmissionStore {
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  async function ensureSchema(): Promise<void> {
    // Schema is managed by drizzle migrations (pnpm --filter @req2rank/hub db:migrate).
    return;
  }

  return {
    async issueNonce(actorId: string): Promise<NonceResponse> {
      await ensureSchema();
      const now = new Date();
      const activeRows = await db
        .select({ count: sql<number>`count(*)` })
        .from(noncesTable)
        .where(and(eq(noncesTable.actorId, actorId), isNull(noncesTable.usedAt), gt(noncesTable.expiresAt, now)));

      if (Number(activeRows[0]?.count ?? 0) >= 3) {
        throw new Error("too many active nonces");
      }

      const nonce = `nonce-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      await db.insert(noncesTable).values({ nonce, actorId, expiresAt, createdAt: now });
      return { nonce, expiresAt: expiresAt.toISOString() };
    },

    async consumeNonce(actorId: string, nonce: string, now = new Date()): Promise<void> {
      await ensureSchema();
      const rows = await db.select().from(noncesTable).where(eq(noncesTable.nonce, nonce)).limit(1);
      const target = rows[0];
      if (!target) {
        throw new Error("nonce not found");
      }
      if (target.actorId !== actorId) {
        throw new Error("nonce actor mismatch");
      }
      if (target.usedAt) {
        throw new Error("nonce already used");
      }
      if (target.expiresAt <= now) {
        throw new Error("nonce expired");
      }

      await db.update(noncesTable).set({ usedAt: now }).where(eq(noncesTable.nonce, nonce));
    },

    async saveSubmission(payload: SubmissionRequest, actorId = "system"): Promise<void> {
      await ensureSchema();
      const verificationStatus = payload.overallScore >= 90 ? "pending" : "verified";

      await db
        .insert(submissionsTable)
        .values({
          runId: payload.runId,
          actorId,
          model: `${payload.targetProvider}/${payload.targetModel}`,
          complexity: payload.complexity ?? "mixed",
          score: payload.overallScore,
          ciLow: payload.ci95?.[0] ?? payload.overallScore,
          ciHigh: payload.ci95?.[1] ?? payload.overallScore,
          agreementLevel: payload.agreementLevel ?? "moderate",
          dimensionScores: payload.dimensionScores ?? {},
          evidenceChain: payload.evidenceChain,
          submittedAt: new Date(payload.submittedAt),
          verificationStatus,
          flagged: false
        })
        .onConflictDoUpdate({
          target: submissionsTable.runId,
          set: {
            actorId,
            model: `${payload.targetProvider}/${payload.targetModel}`,
            complexity: payload.complexity ?? "mixed",
            score: payload.overallScore,
            ciLow: payload.ci95?.[0] ?? payload.overallScore,
            ciHigh: payload.ci95?.[1] ?? payload.overallScore,
            agreementLevel: payload.agreementLevel ?? "moderate",
            dimensionScores: payload.dimensionScores ?? {},
            evidenceChain: payload.evidenceChain,
            submittedAt: new Date(payload.submittedAt),
            verificationStatus,
            flagged: false
          }
        });

      if (payload.overallScore >= 90) {
        await db.insert(reverificationJobsTable).values({ runId: payload.runId, reason: "top-score", queuedAt: new Date() });
      }
    },

    async listLeaderboard(query: ExtendedLeaderboardQuery): Promise<LeaderboardEntry[]> {
      await ensureSchema();
      const { limit, offset, sort, complexity, dimension } = parseLeaderboardQuery(query);
      const strategy = resolveLeaderboardStrategy((query as LeaderboardQuery & { strategy?: string }).strategy);
      const rows = await db.execute<{
        model: string;
        score: number;
        ci_low: number;
        ci_high: number;
        submitted_at: Date;
        dimension_scores: Record<string, number>;
        verification_status: "pending" | "verified" | "disputed";
      }>(sql`
        SELECT model, score, ci_low, ci_high, submitted_at, dimension_scores, verification_status
        FROM hub_submissions
        ${complexity ? sql`WHERE complexity = ${complexity}` : sql``}
      `);

      const normalizedRows: LeaderboardRow[] = rows.map((row) => ({
        model: row.model,
        score: Number(row.score),
        ciLow: Number(row.ci_low),
        ciHigh: Number(row.ci_high),
        submittedAt: row.submitted_at,
        dimensionScores: row.dimension_scores ?? {},
        verificationStatus: row.verification_status
      }));

      return aggregateLeaderboardRows(normalizedRows, sort, strategy, dimension, offset, limit);
    },

    async countSubmissionsForActorDay(actorId: string, dayIsoDate: string): Promise<number> {
      await ensureSchema();
      const dayStart = new Date(`${dayIsoDate}T00:00:00.000Z`);
      const dayEnd = new Date(`${dayIsoDate}T23:59:59.999Z`);
      const rows = await db
        .select({ count: sql<number>`count(*)` })
        .from(submissionsTable)
        .where(
          and(
            eq(submissionsTable.actorId, actorId),
            sql`${submissionsTable.submittedAt} >= ${dayStart}`,
            sql`${submissionsTable.submittedAt} <= ${dayEnd}`
          )
        );
      return Number(rows[0]?.count ?? 0);
    },

    async queueReverification(runId: string, reason: "top-score" | "flagged") {
      await ensureSchema();
      const exists = await db.select({ runId: submissionsTable.runId }).from(submissionsTable).where(eq(submissionsTable.runId, runId)).limit(1);
      if (exists.length === 0) {
        throw new Error(`submission not found: ${runId}`);
      }

      await db.insert(reverificationJobsTable).values({ runId, reason, queuedAt: new Date() });
      await db
        .update(submissionsTable)
        .set({ verificationStatus: "pending", flagged: reason === "flagged" ? true : submissionsTable.flagged })
        .where(eq(submissionsTable.runId, runId));

      return { status: "queued" as const, runId, reason };
    },

    async hasSubmission(runId: string): Promise<boolean> {
      await ensureSchema();
      const rows = await db.select({ runId: submissionsTable.runId }).from(submissionsTable).where(eq(submissionsTable.runId, runId)).limit(1);
      return rows.length > 0;
    },

    async getSubmission(runId: string): Promise<SubmissionDetail | undefined> {
      await ensureSchema();
      const rows = await db.select().from(submissionsTable).where(eq(submissionsTable.runId, runId)).limit(1);
      const row = rows[0];
      return row ? toDetail(row) : undefined;
    },

    async listModelSubmissions(model: string): Promise<SubmissionDetail[]> {
      await ensureSchema();
      const rows = await db.select().from(submissionsTable).where(eq(submissionsTable.model, model)).orderBy(desc(submissionsTable.submittedAt));
      return rows.map((row) => toDetail(row));
    },

    async listQueuedReverificationJobs(limit = 20): Promise<ReverificationJobDetail[]> {
      await ensureSchema();
      const rows = await db
        .select({ runId: reverificationJobsTable.runId, reason: reverificationJobsTable.reason, queuedAt: reverificationJobsTable.queuedAt })
        .from(reverificationJobsTable)
        .orderBy(reverificationJobsTable.queuedAt)
        .limit(limit);

      return rows.map((row) => ({
        runId: row.runId,
        reason: row.reason as ReverificationJobDetail["reason"],
        queuedAt: row.queuedAt.toISOString()
      }));
    },

    async resolveReverificationJob(runId: string, status: "verified" | "disputed"): Promise<void> {
      await ensureSchema();
      await db.update(submissionsTable).set({ verificationStatus: status }).where(eq(submissionsTable.runId, runId));
      await db.execute(sql`DELETE FROM hub_reverification_jobs WHERE run_id = ${runId}`);
    },

    async saveCalibration(record) {
      await ensureSchema();
      const [row] = await db
        .insert(calibrationSnapshotsTable)
        .values({
          source: record.source,
          actorId: record.actorId ?? null,
          recommendedComplexity: record.recommendedComplexity,
          reason: record.reason,
          averageScore: record.averageScore,
          sampleSize: record.sampleSize,
          createdAt: new Date()
        })
        .returning();

      return {
        id: String(row.id),
        source: row.source,
        actorId: row.actorId ?? undefined,
        recommendedComplexity: row.recommendedComplexity as "C1" | "C2" | "C3" | "C4",
        reason: row.reason,
        averageScore: row.averageScore,
        sampleSize: row.sampleSize,
        createdAt: row.createdAt.toISOString()
      };
    },

    async listCalibrations(limit = 20) {
      await ensureSchema();
      const rows = await db
        .select()
        .from(calibrationSnapshotsTable)
        .orderBy(desc(calibrationSnapshotsTable.createdAt))
        .limit(limit);

      return rows.map((row) => ({
        id: String(row.id),
        source: row.source,
        actorId: row.actorId ?? undefined,
        recommendedComplexity: row.recommendedComplexity as "C1" | "C2" | "C3" | "C4",
        reason: row.reason,
        averageScore: row.averageScore,
        sampleSize: row.sampleSize,
        createdAt: row.createdAt.toISOString()
      }));
    }
  };
}

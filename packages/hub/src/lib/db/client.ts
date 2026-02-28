import { and, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { LeaderboardEntry, LeaderboardQuery, NonceResponse, SubmissionRequest, parseLeaderboardQuery } from "@req2rank/core";
import { ExtendedLeaderboardQuery, ReverificationJobDetail, ReverificationReason, SubmissionDetail, SubmissionStore } from "../../routes";
import { LeaderboardAggregationStrategy, resolveLeaderboardStrategy } from "../leaderboard-strategy";
import { calibrationSnapshotsTable, noncesTable, reverificationJobsTable, submissionsTable } from "./schema";

type AggregatedLeaderboardRow = {
  model: string;
  score: number;
  ci_low: number;
  ci_high: number;
  verification_status: "pending" | "verified" | "disputed";
};

function toDetail(row: {
  runId: string;
  model: string;
  complexity: string;
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
    complexity: row.complexity as SubmissionDetail["complexity"],
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
  let schemaEnsured = false;

  async function ensureSchema(): Promise<void> {
    if (schemaEnsured) {
      return;
    }
    await db.execute(sql`
      create index if not exists hub_submissions_model_complexity_submitted_idx
      on hub_submissions (model, complexity, submitted_at desc)
    `);
    await db.execute(sql`
      create index if not exists hub_submissions_complexity_idx
      on hub_submissions (complexity)
    `);
    await db.execute(sql`
      create index if not exists hub_submissions_verification_status_idx
      on hub_submissions (verification_status)
    `);
    await db.execute(sql`
      delete from hub_reverification_jobs older
      using hub_reverification_jobs newer
      where older.run_id = newer.run_id
        and older.reason = newer.reason
        and older.id > newer.id
    `);
    await db.execute(sql`
      create unique index if not exists hub_reverification_jobs_run_reason_uq
      on hub_reverification_jobs (run_id, reason)
    `);
    schemaEnsured = true;
  }

  function resolveModelScoreDriftThreshold(): number {
    const raw = process.env.R2R_MODEL_SCORE_DRIFT_THRESHOLD;
    if (!raw) {
      return 5;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  }

  function resolveModelScoreDriftMinSamples(): number {
    const raw = process.env.R2R_MODEL_SCORE_DRIFT_MIN_SAMPLES;
    if (!raw) {
      return 3;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
  }

  async function queueReverificationInternal(runId: string, reason: ReverificationReason): Promise<void> {
    try {
      await db.insert(reverificationJobsTable).values({ runId, reason, queuedAt: new Date() });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("duplicate key")) {
        throw error;
      }
    }
  }

  async function resolveAutoReviewReason(payload: SubmissionRequest): Promise<ReverificationReason | undefined> {
    const model = `${payload.targetProvider}/${payload.targetModel}`;
    const baselineRows = await db
      .select({ score: submissionsTable.score })
      .from(submissionsTable)
      .where(
        and(
          eq(submissionsTable.model, model),
          ne(submissionsTable.verificationStatus, "disputed"),
          ne(submissionsTable.runId, payload.runId)
        )
      );

    const minSamples = resolveModelScoreDriftMinSamples();
    if (baselineRows.length >= minSamples) {
      const baselineMean = baselineRows.reduce((sum, row) => sum + Number(row.score), 0) / baselineRows.length;
      const driftThreshold = resolveModelScoreDriftThreshold();
      const scoreDrift = Math.abs(payload.overallScore - baselineMean);
      if (scoreDrift > driftThreshold) {
        return "score-drift";
      }
    }

    if (payload.overallScore >= 90) {
      return "top-score";
    }

    return undefined;
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

      const nonce = `nonce-${Date.now()}-${randomBytes(6).toString("hex")}`;
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      await db.insert(noncesTable).values({ nonce, actorId, expiresAt, createdAt: now });
      return { nonce, expiresAt: expiresAt.toISOString() };
    },

    async consumeNonce(actorId: string, nonce: string, now = new Date()): Promise<void> {
      await ensureSchema();
      const consumed = await db
        .update(noncesTable)
        .set({ usedAt: now })
        .where(
          and(
            eq(noncesTable.nonce, nonce),
            eq(noncesTable.actorId, actorId),
            isNull(noncesTable.usedAt),
            gt(noncesTable.expiresAt, now)
          )
        )
        .returning({ nonce: noncesTable.nonce });

      if (consumed.length > 0) {
        return;
      }

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
    },

    async saveSubmission(payload: SubmissionRequest, actorId = "system"): Promise<void> {
      await ensureSchema();
      const autoReviewReason = await resolveAutoReviewReason(payload);
      const verificationStatus = autoReviewReason ? "pending" : "verified";

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
            verificationStatus
          }
        });

      if (autoReviewReason) {
        await queueReverificationInternal(payload.runId, autoReviewReason);
      }
    },

    async listLeaderboard(query: ExtendedLeaderboardQuery): Promise<LeaderboardEntry[]> {
      await ensureSchema();
      const { limit, offset, sort, complexity, dimension } = parseLeaderboardQuery(query);
      const strategy = resolveLeaderboardStrategy((query as LeaderboardQuery & { strategy?: string }).strategy);
      const sortDirection = sort === "asc" ? sql`asc` : sql`desc`;
      const metricExpr = dimension
        ? sql<number>`coalesce((dimension_scores ->> ${dimension})::double precision, 0)`
        : sql<number>`score`;
      const baseWhere = complexity ? sql`where complexity = ${complexity}` : sql``;

      let rows: AggregatedLeaderboardRow[];

      if (strategy === "mean") {
        rows = await db.execute<AggregatedLeaderboardRow>(sql`
          with aggregated as (
            select
              model,
              avg(score)::double precision as score,
              avg(ci_low)::double precision as ci_low,
              avg(ci_high)::double precision as ci_high,
              case
                when bool_or(verification_status = 'disputed') then 'disputed'
                when bool_or(verification_status = 'pending') then 'pending'
                else 'verified'
              end as verification_status,
              avg(${metricExpr})::double precision as metric
            from hub_submissions
            ${baseWhere}
            group by model
          )
          select model, score, ci_low, ci_high, verification_status
          from aggregated
          order by metric ${sortDirection}, model asc
          limit ${limit} offset ${offset}
        `);
      } else if (strategy === "latest") {
        rows = await db.execute<AggregatedLeaderboardRow>(sql`
          with picked as (
            select distinct on (model)
              model,
              score,
              ci_low,
              ci_high,
              verification_status,
              ${metricExpr} as metric,
              submitted_at
            from hub_submissions
            ${baseWhere}
            order by model, submitted_at desc
          )
          select model, score, ci_low, ci_high, verification_status
          from picked
          order by metric ${sortDirection}, model asc
          limit ${limit} offset ${offset}
        `);
      } else {
        const bestMetricDirection = sort === "asc" ? sql`asc` : sql`desc`;
        rows = await db.execute<AggregatedLeaderboardRow>(sql`
          with picked as (
            select distinct on (model)
              model,
              score,
              ci_low,
              ci_high,
              verification_status,
              ${metricExpr} as metric
            from hub_submissions
            ${baseWhere}
            order by model, ${metricExpr} ${bestMetricDirection}, submitted_at desc
          )
          select model, score, ci_low, ci_high, verification_status
          from picked
          order by metric ${sortDirection}, model asc
          limit ${limit} offset ${offset}
        `);
      }

      return rows.map((row, index) => ({
        rank: offset + index + 1,
        model: row.model,
        score: Number(row.score),
        ci95: [Number(row.ci_low), Number(row.ci_high)],
        verificationStatus: row.verification_status
      }));
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

    async queueReverification(runId: string, reason: ReverificationReason) {
      await ensureSchema();
      const exists = await db.select({ runId: submissionsTable.runId }).from(submissionsTable).where(eq(submissionsTable.runId, runId)).limit(1);
      if (exists.length === 0) {
        throw new Error(`submission not found: ${runId}`);
      }

      await queueReverificationInternal(runId, reason);

      const update: { verificationStatus: "pending"; flagged?: boolean } = { verificationStatus: "pending" };
      if (reason === "flagged") {
        update.flagged = true;
      }
      await db.update(submissionsTable).set(update).where(eq(submissionsTable.runId, runId));

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

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { LeaderboardEntry, LeaderboardQuery, NonceResponse, SubmissionRequest, parseLeaderboardQuery } from "@req2rank/core";
import { ReverificationJobDetail, SubmissionDetail, SubmissionStore } from "../../routes.js";
import { calibrationSnapshotsTable, noncesTable, reverificationJobsTable, submissionsTable } from "./schema.js";

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

    async listLeaderboard(query: LeaderboardQuery): Promise<LeaderboardEntry[]> {
      await ensureSchema();
      const { limit, offset, sort, complexity, dimension } = parseLeaderboardQuery(query);

      const rows = await db.execute<{
        model: string;
        complexity: string;
        score: number;
        ci_low: number;
        ci_high: number;
        dimension_scores: Record<string, number>;
        verification_status: "pending" | "verified" | "disputed";
      }>(sql`
        SELECT model, complexity, score, ci_low, ci_high, dimension_scores, verification_status
        FROM hub_submissions
        ${complexity ? sql`WHERE complexity = ${complexity}` : sql``}
      `);

      const metric = (row: {
        score: number;
        dimension_scores: Record<string, number>;
      }): number => {
        if (!dimension) {
          return Number(row.score);
        }
        return Number(row.dimension_scores?.[dimension] ?? 0);
      };

      const bestByModel = new Map<string, (typeof rows)[number]>();
      for (const row of rows) {
        const previous = bestByModel.get(row.model);
        if (!previous || metric(row) > metric(previous)) {
          bestByModel.set(row.model, row);
        }
      }

      const sorted = Array.from(bestByModel.values())
        .slice()
        .sort((left, right) => (sort === "asc" ? metric(left) - metric(right) : metric(right) - metric(left)))
        .slice(offset, offset + limit);

      return sorted.map((item, index) => ({
        rank: offset + index + 1,
        model: item.model,
        score: Number(item.score),
        ci95: [Number(item.ci_low), Number(item.ci_high)],
        verificationStatus: item.verification_status
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

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { LeaderboardEntry, LeaderboardQuery, NonceResponse, SubmissionRequest, parseLeaderboardQuery } from "@req2rank/core";
import { ReverificationJobDetail, SubmissionDetail, SubmissionStore } from "../../routes.js";
import { noncesTable, reverificationJobsTable, submissionsTable } from "./schema.js";

function toDetail(row: {
  runId: string;
  model: string;
  score: number;
  ciLow: number;
  ciHigh: number;
  agreementLevel: string;
  dimensionScores: unknown;
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
    submittedAt: row.submittedAt.toISOString(),
    verificationStatus: row.verificationStatus as SubmissionDetail["verificationStatus"]
  };
}

export function createDrizzleSubmissionStore(databaseUrl: string): SubmissionStore {
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  let schemaReady: Promise<void> | undefined;

  async function ensureSchema(): Promise<void> {
    if (!schemaReady) {
      schemaReady = (async () => {
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS hub_nonces (
            nonce TEXT PRIMARY KEY,
            actor_id TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS hub_submissions (
            run_id TEXT PRIMARY KEY,
            model TEXT NOT NULL,
            score REAL NOT NULL,
            ci_low REAL NOT NULL DEFAULT 0,
            ci_high REAL NOT NULL DEFAULT 0,
            agreement_level TEXT NOT NULL DEFAULT 'moderate',
            dimension_scores JSONB NOT NULL DEFAULT '{}',
            submitted_at TIMESTAMPTZ NOT NULL,
            verification_status TEXT NOT NULL,
            flagged BOOLEAN NOT NULL DEFAULT FALSE
          )
        `);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS hub_reverification_jobs (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            run_id TEXT NOT NULL,
            reason TEXT NOT NULL,
            queued_at TIMESTAMPTZ NOT NULL
          )
        `);
      })();
    }

    await schemaReady;
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

    async saveSubmission(payload: SubmissionRequest): Promise<void> {
      await ensureSchema();
      const verificationStatus = payload.overallScore >= 90 ? "pending" : "verified";

      await db
        .insert(submissionsTable)
        .values({
          runId: payload.runId,
          model: `${payload.targetProvider}/${payload.targetModel}`,
          score: payload.overallScore,
          ciLow: payload.ci95?.[0] ?? payload.overallScore,
          ciHigh: payload.ci95?.[1] ?? payload.overallScore,
          agreementLevel: payload.agreementLevel ?? "moderate",
          dimensionScores: payload.dimensionScores ?? {},
          submittedAt: new Date(payload.submittedAt),
          verificationStatus,
          flagged: false
        })
        .onConflictDoUpdate({
          target: submissionsTable.runId,
          set: {
            model: `${payload.targetProvider}/${payload.targetModel}`,
            score: payload.overallScore,
            ciLow: payload.ci95?.[0] ?? payload.overallScore,
            ciHigh: payload.ci95?.[1] ?? payload.overallScore,
            agreementLevel: payload.agreementLevel ?? "moderate",
            dimensionScores: payload.dimensionScores ?? {},
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
      const { limit, offset, sort } = parseLeaderboardQuery(query);

      const rows = await db.execute<{
        model: string;
        score: number;
        ci_low: number;
        ci_high: number;
        verification_status: "pending" | "verified" | "disputed";
      }>(sql`
        SELECT DISTINCT ON (model) model, score, ci_low, ci_high, verification_status
        FROM hub_submissions
        ORDER BY model, score DESC
      `);

      const sorted = rows
        .slice()
        .sort((left, right) => (sort === "asc" ? left.score - right.score : right.score - left.score))
        .slice(offset, offset + limit);

      return sorted.map((item, index) => ({
        rank: offset + index + 1,
        model: item.model,
        score: Number(item.score),
        ci95: [Number(item.ci_low), Number(item.ci_high)],
        verificationStatus: item.verification_status
      }));
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
    }
  };
}

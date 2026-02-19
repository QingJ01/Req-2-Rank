import { boolean, integer, jsonb, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";

export const noncesTable = pgTable("hub_nonces", {
  nonce: text("nonce").primaryKey(),
  actorId: text("actor_id").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull()
});

export const submissionsTable = pgTable("hub_submissions", {
  runId: text("run_id").primaryKey(),
  actorId: text("actor_id").notNull().default(""),
  model: text("model").notNull(),
  score: real("score").notNull(),
  ciLow: real("ci_low").notNull().default(0),
  ciHigh: real("ci_high").notNull().default(0),
  agreementLevel: text("agreement_level").notNull().default("moderate"),
  dimensionScores: jsonb("dimension_scores").notNull().default({}),
  evidenceChain: jsonb("evidence_chain"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull(),
  verificationStatus: text("verification_status").notNull(),
  flagged: boolean("flagged").notNull().default(false)
});

export const reverificationJobsTable = pgTable("hub_reverification_jobs", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  runId: text("run_id").notNull(),
  reason: text("reason").notNull(),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull()
});

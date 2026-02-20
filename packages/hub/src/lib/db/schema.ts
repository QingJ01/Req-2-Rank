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
  complexity: text("complexity").notNull().default("mixed"),
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

export const oauthPendingStatesTable = pgTable("hub_oauth_pending_states", {
  state: text("state").primaryKey(),
  actorIdHint: text("actor_id_hint"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const oauthSessionsTable = pgTable("hub_oauth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  actorId: text("actor_id").notNull(),
  accessToken: text("access_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const calibrationSnapshotsTable = pgTable("hub_calibration_snapshots", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  source: text("source").notNull().default("local"),
  actorId: text("actor_id"),
  recommendedComplexity: text("recommended_complexity").notNull(),
  reason: text("reason").notNull(),
  averageScore: real("average_score").notNull(),
  sampleSize: integer("sample_size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const communityReportsTable = pgTable("hub_community_reports", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("open"),
  resolverActorId: text("resolver_actor_id"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const adminActionLogsTable = pgTable("hub_admin_action_logs", {
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  reportId: text("report_id"),
  runId: text("run_id"),
  queueReverification: boolean("queue_reverification").notNull().default(false),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

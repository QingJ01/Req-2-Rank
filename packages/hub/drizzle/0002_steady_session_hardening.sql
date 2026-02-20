ALTER TABLE "hub_submissions" ADD COLUMN IF NOT EXISTS "actor_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_submissions" ADD COLUMN IF NOT EXISTS "complexity" text DEFAULT 'mixed' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_submissions" ADD COLUMN IF NOT EXISTS "evidence_chain" jsonb;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "hub_oauth_pending_states" (
	"state" text PRIMARY KEY NOT NULL,
	"actor_id_hint" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "hub_oauth_sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"access_token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "hub_calibration_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"source" text DEFAULT 'local' NOT NULL,
	"actor_id" text,
	"recommended_complexity" text NOT NULL,
	"reason" text NOT NULL,
	"average_score" real NOT NULL,
	"sample_size" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

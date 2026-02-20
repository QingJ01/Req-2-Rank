CREATE TABLE IF NOT EXISTS "hub_community_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"resolver_actor_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "hub_admin_action_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"report_id" text,
	"run_id" text,
	"queue_reverification" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

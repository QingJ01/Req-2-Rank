CREATE TABLE "hub_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_reverification_jobs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "hub_reverification_jobs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"reason" text NOT NULL,
	"queued_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_submissions" (
	"run_id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"score" real NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"verification_status" text NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL
);

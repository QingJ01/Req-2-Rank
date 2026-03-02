CREATE TABLE IF NOT EXISTS "hub_actor_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"label" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hub_actor_tokens_actor_id_idx" ON "hub_actor_tokens" ("actor_id");

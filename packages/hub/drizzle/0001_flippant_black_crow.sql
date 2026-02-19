ALTER TABLE "hub_submissions" ADD COLUMN "ci_low" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_submissions" ADD COLUMN "ci_high" real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_submissions" ADD COLUMN "agreement_level" text DEFAULT 'moderate' NOT NULL;--> statement-breakpoint
ALTER TABLE "hub_submissions" ADD COLUMN "dimension_scores" jsonb DEFAULT '{}'::jsonb NOT NULL;
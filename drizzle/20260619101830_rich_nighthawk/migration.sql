CREATE TABLE "subscribe_sagas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar NOT NULL,
	"repo_name" varchar NOT NULL,
	"status" varchar DEFAULT 'awaiting_repo' NOT NULL,
	"failure_reason" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_repositories" (
	"id" uuid PRIMARY KEY,
	"name" varchar NOT NULL UNIQUE
);
--> statement-breakpoint
INSERT INTO "subscription_repositories" ("id", "name")
SELECT "id", "name" FROM "github_repositories"
ON CONFLICT ("id") DO NOTHING;

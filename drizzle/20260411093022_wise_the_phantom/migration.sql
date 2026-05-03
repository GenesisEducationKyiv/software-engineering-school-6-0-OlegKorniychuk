CREATE TABLE "github_repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" varchar NOT NULL UNIQUE,
	"last_seen_tag" varchar
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "github_repository_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "repository";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN "last_seen_tag";--> statement-breakpoint
CREATE UNIQUE INDEX "repo_email_idx" ON "subscriptions" ("email","github_repository_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_github_repository_id_github_repositories_id_fkey" FOREIGN KEY ("github_repository_id") REFERENCES "github_repositories"("id");
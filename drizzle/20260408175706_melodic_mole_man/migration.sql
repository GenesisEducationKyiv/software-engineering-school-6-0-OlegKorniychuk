CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar NOT NULL,
	"repository" varchar NOT NULL,
	"last_seen_tag" varchar,
	"confirmed" boolean DEFAULT false
);

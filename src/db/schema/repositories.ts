import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const githubRepositories = pgTable('github_repositories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull().unique(),
  lastSeenTag: varchar('last_seen_tag'),
});

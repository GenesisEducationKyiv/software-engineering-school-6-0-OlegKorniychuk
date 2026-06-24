import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const subscribeSagas = pgTable('subscribe_sagas', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email').notNull(),
  repoName: varchar('repo_name').notNull(),
  status: varchar('status').notNull().default('awaiting_repo'),
  failureReason: varchar('failure_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

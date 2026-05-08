import {
  boolean,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { githubRepositories } from './repositories.js';

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email').notNull(),
    githubRepositoryId: uuid('github_repository_id')
      .references(() => githubRepositories.id)
      .notNull(),
    confirmed: boolean('confirmed').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('repo_email_idx').on(table.email, table.githubRepositoryId),
  ],
);

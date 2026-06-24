import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

export const subscriptionRepositories = pgTable('subscription_repositories', {
  id: uuid('id').primaryKey(),
  name: varchar('name').notNull().unique(),
});

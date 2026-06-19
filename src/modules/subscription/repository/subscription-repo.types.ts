import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { subscriptionRepositories } from '../../../shared/db/schema/subscription-repositories.js';

export type SubscriptionRepo = InferSelectModel<
  typeof subscriptionRepositories
>;
export type CreateSubscriptionRepo = InferInsertModel<
  typeof subscriptionRepositories
>;

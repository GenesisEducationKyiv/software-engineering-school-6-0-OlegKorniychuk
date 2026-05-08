import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { subscriptions } from '../../db/schema/subscriptions.js';
import type { SubscriptionRepository } from './subscription.repository.js';

export type Subscription = InferSelectModel<typeof subscriptions>;
export type CreateSubscription = InferInsertModel<typeof subscriptions>;
export type SubscriptionWithRepository = Awaited<
  ReturnType<SubscriptionRepository['findByEmailWithRepo']>
>[number];

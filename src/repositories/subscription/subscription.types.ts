import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { subscriptions } from '../../db/schema/subscriptions.js';

export type Subscription = InferSelectModel<typeof subscriptions>;
export type CreateSubscription = InferInsertModel<typeof subscriptions>;

import type { SubscriptionWithRepository } from './repository/subscription.repository.interface.js';
import type { Subscription } from './repository/subscription.types.js';

export type SubscribeResult =
  | { status: 'created' }
  | { status: 'pending'; sagaId: string };

export interface SubscriptionService {
  getCacheKey(email: string): string;
  subscribe(
    email: string,
    owner: string,
    repositoryName: string,
  ): Promise<SubscribeResult>;
  confirmSubscription(token: string): Promise<void>;
  unsubscribe(token: string): Promise<void>;
  getSubscriptions(email: string): Promise<SubscriptionWithRepository[]>;
  getConfirmedSubscribersByRepo(repoId: string): Promise<Subscription[]>;
}

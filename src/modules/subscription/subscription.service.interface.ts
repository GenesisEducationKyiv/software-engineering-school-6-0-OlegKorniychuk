import type { SubscriptionWithRepository } from '../../repositories/subscription/subscription.repository.interface.js';

export interface SubscriptionService {
  getCacheKey(email: string): string;
  subscribe(
    email: string,
    owner: string,
    repositoryName: string,
  ): Promise<void>;
  confirmSubscription(token: string): Promise<void>;
  unsubscribe(token: string): Promise<void>;
  getSubscriptions(email: string): Promise<SubscriptionWithRepository[]>;
}

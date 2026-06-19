import type { CreateSubscriptionRepo, SubscriptionRepo } from './subscription-repo.types.js';

export interface SubscriptionRepoRepository {
  findByName(name: string): Promise<SubscriptionRepo | null>;
  findById(id: string): Promise<SubscriptionRepo | null>;
  createOne(data: CreateSubscriptionRepo): Promise<SubscriptionRepo>;
}

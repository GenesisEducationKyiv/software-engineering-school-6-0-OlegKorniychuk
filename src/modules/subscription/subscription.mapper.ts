import type { SubscriptionWithRepository } from '../../repositories/subscription/subscription.types.js';
import type { SubscriptionResponse } from './subscription.types.js';

export interface SubscriptionResponseMapper {
  toListResponse(
    entities: SubscriptionWithRepository[],
  ): SubscriptionResponse[];
}

export const subscriptionMapper: SubscriptionResponseMapper = {
  toListResponse(
    entities: SubscriptionWithRepository[],
  ): SubscriptionResponse[] {
    return entities.map((e) => ({
      email: e.email,
      repo: e.githubRepository.name,
      confirmed: e.confirmed,
      last_seen_tag: e.githubRepository.lastSeenTag,
    }));
  },
};

import type { SubscriptionService } from './subscription.service.interface.js';
import type { NotificationTokensService } from './tokens/notification-tokens.service.interface.js';

export type SubscriberInfo = { email: string; unsubscribeToken: string };

export class SubscriptionFacade {
  constructor(
    private readonly service: SubscriptionService,
    private readonly tokensService: NotificationTokensService,
  ) {}

  public async getConfirmedSubscribersWithTokens(
    repoId: string,
  ): Promise<SubscriberInfo[]> {
    const subscribers =
      await this.service.getConfirmedSubscribersByRepo(repoId);
    return subscribers.map((sub) => ({
      email: sub.email,
      unsubscribeToken: this.tokensService.generateUnsubscribeToken(sub.id),
    }));
  }
}

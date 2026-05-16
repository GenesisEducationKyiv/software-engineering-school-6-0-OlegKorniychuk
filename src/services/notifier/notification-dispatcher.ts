import type { SubscriptionRepository } from '../../repositories/subscription/subscription.repository.interface.js';
import type { EmailQueueClient } from '../email-queue/email-queue.service.interface.js';
import type { NotificationTokensService } from '../notification-tokens-service/notification-tokens.service.interface.js';
import type { NotificationDispatcher } from './notification-dispatcher.interface.js';

export class NotificationDispatcherImplementation implements NotificationDispatcher {
  constructor(
    private readonly subscriptionRepo: SubscriptionRepository,
    private readonly tokensService: NotificationTokensService,
    private readonly emailQueue: EmailQueueClient,
  ) {}

  public async dispatchNotifications(
    repoId: string,
    repoName: string,
    releaseTag: string,
  ): Promise<number> {
    const subscriptions =
      await this.subscriptionRepo.findConfirmedByRepoId(repoId);
    let emailsQueued = 0;

    for (const sub of subscriptions) {
      const token = this.tokensService.generateUnsubscribeToken(sub.id);

      await this.emailQueue.queueNotificationEmail({
        email: sub.email,
        token: token,
        repo: repoName,
        release: releaseTag,
      });
      emailsQueued++;
    }

    return emailsQueued;
  }
}

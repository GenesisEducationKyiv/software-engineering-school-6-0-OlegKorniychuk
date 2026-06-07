import type { EmailQueueClient } from '../queue/email-queue.service.interface.js';
import type {
  NotificationDispatcher,
  SubscriberInfo,
} from './notification-dispatcher.interface.js';

export class NotificationDispatcherImplementation implements NotificationDispatcher {
  constructor(private readonly emailQueue: EmailQueueClient) {}

  public async dispatchNotifications(
    subscribers: SubscriberInfo[],
    repoName: string,
    releaseTag: string,
  ): Promise<number> {
    let emailsQueued = 0;

    for (const sub of subscribers) {
      await this.emailQueue.queueNotificationEmail({
        email: sub.email,
        token: sub.unsubscribeToken,
        repo: repoName,
        release: releaseTag,
      });
      emailsQueued++;
    }

    return emailsQueued;
  }
}

import type { INotificationFacade } from './notification.facade.interface.js';
import type { EmailQueueClient } from './queue/email-queue.service.interface.js';
import type {
  NotificationDispatcher,
  SubscriberInfo,
} from './notifier/notification-dispatcher.interface.js';

export class NotificationFacade implements INotificationFacade {
  constructor(
    private readonly emailQueue: EmailQueueClient,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  public async queueConfirmationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    await this.emailQueue.queueConfirmationEmail({ email, token });
  }

  public async dispatchToSubscribers(
    subscribers: SubscriberInfo[],
    repoName: string,
    releaseTag: string,
  ): Promise<number> {
    return this.dispatcher.dispatchNotifications(
      subscribers,
      repoName,
      releaseTag,
    );
  }
}

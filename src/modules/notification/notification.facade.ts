import type { EmailQueueClient } from './queue/email-queue.service.interface.js';
import type { NotificationDispatcher } from './notifier/notification-dispatcher.interface.js';

export class NotificationFacade {
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
    repoId: string,
    repoName: string,
    releaseTag: string,
  ): Promise<number> {
    return this.dispatcher.dispatchNotifications(repoId, repoName, releaseTag);
  }
}

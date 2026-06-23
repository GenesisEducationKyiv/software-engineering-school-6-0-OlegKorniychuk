import type { SubscriberInfo } from './notifier/notification-dispatcher.interface.js';

export interface INotificationFacade {
  queueConfirmationEmail(email: string, token: string): Promise<void>;
  dispatchToSubscribers(
    subscribers: SubscriberInfo[],
    repoName: string,
    releaseTag: string,
  ): Promise<number>;
}

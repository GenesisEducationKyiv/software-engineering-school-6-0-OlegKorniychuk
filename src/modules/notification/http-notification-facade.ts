import type { INotificationFacade } from './notification.facade.interface.js';
import type { SubscriberInfo } from './notifier/notification-dispatcher.interface.js';

export class HttpNotificationFacade implements INotificationFacade {
  constructor(private readonly baseUrl: string) {}

  public async queueConfirmationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/emails/confirmation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token }),
    });
    if (!res.ok) {
      throw new Error(
        `Notification service error ${res.status}: ${await res.text()}`,
      );
    }
  }

  public async dispatchToSubscribers(
    subscribers: SubscriberInfo[],
    repoName: string,
    releaseTag: string,
  ): Promise<number> {
    const res = await fetch(`${this.baseUrl}/emails/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscribers, repoName, releaseTag }),
    });
    if (!res.ok) {
      throw new Error(
        `Notification service error ${res.status}: ${await res.text()}`,
      );
    }
    const body = (await res.json()) as { queued: number };
    return body.queued;
  }
}

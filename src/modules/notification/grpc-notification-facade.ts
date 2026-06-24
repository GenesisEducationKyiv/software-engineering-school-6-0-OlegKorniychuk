import { createClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { NotificationService } from '../../generated/notification/v1/notification_pb.js';
import type { INotificationFacade } from './notification.facade.interface.js';
import type { SubscriberInfo } from './notifier/notification-dispatcher.interface.js';

export class GrpcNotificationFacade implements INotificationFacade {
  private readonly client: ReturnType<
    typeof createClient<typeof NotificationService>
  >;

  constructor(baseUrl: string) {
    const transport = createGrpcTransport({ baseUrl });
    this.client = createClient(NotificationService, transport);
  }

  public async queueConfirmationEmail(
    email: string,
    token: string,
  ): Promise<void> {
    await this.client.queueConfirmationEmail({ email, token });
  }

  public async dispatchToSubscribers(
    subscribers: SubscriberInfo[],
    repoName: string,
    releaseTag: string,
  ): Promise<number> {
    const response = await this.client.dispatchToSubscribers({
      subscribers,
      repoName,
      releaseTag,
    });
    return response.queued;
  }
}

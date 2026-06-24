import type amqplib from 'amqplib';
import type { Logger } from 'pino';
import { createRabbitMQChannel } from '../../shared/messaging/rabbitmq.js';
import {
  RELEASES_EXCHANGE,
  RELEASE_DETECTED_ROUTING_KEY,
  RELEASE_DETECTED_QUEUE,
  type ReleaseDetectedEvent,
} from '../../shared/messaging/release-detected.event.js';
import type { NotificationFacade } from './notification.facade.js';
import type { SubscriptionFacade } from '../subscription/subscription.facade.js';
import type { ConsumeMessage } from 'amqplib';

export class ReleaseDetectedWorker {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly rabbitmqUrl: string,
    private readonly subscription: SubscriptionFacade,
    private readonly notification: NotificationFacade,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    const result = await createRabbitMQChannel(
      this.rabbitmqUrl,
      RELEASES_EXCHANGE,
    );
    this.connection = result.connection;
    this.channel = result.channel;

    await this.channel.assertQueue(RELEASE_DETECTED_QUEUE, { durable: true });
    await this.channel.bindQueue(
      RELEASE_DETECTED_QUEUE,
      RELEASES_EXCHANGE,
      RELEASE_DETECTED_ROUTING_KEY,
    );
    this.channel.prefetch(1);

    const { consumerTag } = await this.channel.consume(
      RELEASE_DETECTED_QUEUE,
      async (msg) => {
        if (!msg) return;
        try {
          await this.handleMessage(msg);
        } catch (err) {
          this.logger.error(
            { err },
            '[ReleaseDetectedWorker]: Failed to process message',
          );
          this.channel!.nack(msg, false, false);
        }
      },
    );

    this.consumerTag = consumerTag;
  }

  public async close(): Promise<void> {
    if (this.consumerTag && this.channel) {
      await this.channel.cancel(this.consumerTag);
    }
    await this.connection?.close();
  }

  private async handleMessage(message: ConsumeMessage) {
    const payload = JSON.parse(
      message.content.toString(),
    ) as ReleaseDetectedEvent;
    const { repoId, repoName, releaseTag } = payload;

    const subscribers =
      await this.subscription.getConfirmedSubscribersWithTokens(repoId);

    await this.notification.dispatchToSubscribers(
      subscribers,
      repoName,
      releaseTag,
    );

    this.logger.info(
      { repoName, releaseTag, count: subscribers.length },
      '[ReleaseDetectedWorker]: Dispatched notifications',
    );

    this.channel!.ack(message);
  }
}

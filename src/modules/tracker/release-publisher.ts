import type amqplib from 'amqplib';
import { createRabbitMQChannel } from '../../shared/messaging/rabbitmq.js';
import {
  RELEASES_EXCHANGE,
  RELEASE_DETECTED_ROUTING_KEY,
  type ReleaseDetectedEvent,
} from '../../shared/messaging/release-detected.event.js';

export class ReleasePublisher {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly rabbitmqUrl: string) {}

  public async connect(): Promise<void> {
    const result = await createRabbitMQChannel(
      this.rabbitmqUrl,
      RELEASES_EXCHANGE,
    );
    this.connection = result.connection;
    this.channel = result.channel;
  }

  public async publish(
    repoId: string,
    repoName: string,
    releaseTag: string,
  ): Promise<void> {
    if (!this.channel) throw new Error('[ReleasePublisher]: Not connected');
    const payload: ReleaseDetectedEvent = { repoId, repoName, releaseTag };
    this.channel.publish(
      RELEASES_EXCHANGE,
      RELEASE_DETECTED_ROUTING_KEY,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
  }

  public async close(): Promise<void> {
    await this.connection?.close();
  }
}

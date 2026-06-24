import type amqplib from 'amqplib';
import { createRabbitMQChannel } from '../../../shared/messaging/rabbitmq.js';
import {
  REPOSITORIES_EXCHANGE,
  REPO_CREATE_REQUESTED_KEY,
  type RepoCreateRequestedCommand,
} from '../../../shared/messaging/repository.events.js';

export class RepoCommandPublisher {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  constructor(private readonly rabbitmqUrl: string) {}

  public async connect(): Promise<void> {
    const result = await createRabbitMQChannel(
      this.rabbitmqUrl,
      REPOSITORIES_EXCHANGE,
    );
    this.connection = result.connection;
    this.channel = result.channel;
  }

  public async publishCreateRequested(
    command: RepoCreateRequestedCommand,
  ): Promise<void> {
    if (!this.channel) throw new Error('[RepoCommandPublisher]: Not connected');
    this.channel.publish(
      REPOSITORIES_EXCHANGE,
      REPO_CREATE_REQUESTED_KEY,
      Buffer.from(JSON.stringify(command)),
      { persistent: true },
    );
  }

  public async close(): Promise<void> {
    await this.connection?.close();
  }
}

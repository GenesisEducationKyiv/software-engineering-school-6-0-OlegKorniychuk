import type amqplib from 'amqplib';
import { createRabbitMQChannel } from '../../../shared/messaging/rabbitmq.js';
import {
  REPOSITORIES_EXCHANGE,
  REPO_CREATED_KEY,
  REPO_CREATE_FAILED_KEY,
  type RepoCreatedEvent,
  type RepoCreateFailedEvent,
} from '../../../shared/messaging/repository.events.js';

export class RepoEventPublisher {
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

  public async publishCreated(event: RepoCreatedEvent): Promise<void> {
    this.assertChannel();
    this.channel!.publish(
      REPOSITORIES_EXCHANGE,
      REPO_CREATED_KEY,
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
    );
  }

  public async publishFailed(event: RepoCreateFailedEvent): Promise<void> {
    this.assertChannel();
    this.channel!.publish(
      REPOSITORIES_EXCHANGE,
      REPO_CREATE_FAILED_KEY,
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
    );
  }

  public async close(): Promise<void> {
    await this.connection?.close();
  }

  private assertChannel(): void {
    if (!this.channel) throw new Error('[RepoEventPublisher]: Not connected');
  }
}

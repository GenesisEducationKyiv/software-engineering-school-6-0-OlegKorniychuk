import type amqplib from 'amqplib';
import type { Logger } from 'pino';
import { createRabbitMQChannel } from '../../../shared/messaging/rabbitmq.js';
import {
  REPOSITORIES_EXCHANGE,
  REPO_CREATED_KEY,
  REPO_CREATE_FAILED_KEY,
  REPO_EVENTS_QUEUE,
  type RepoCreatedEvent,
  type RepoCreateFailedEvent,
} from '../../../shared/messaging/repository.events.js';
import type { SubscriptionRepoRepository } from '../repository/subscription-repo.repository.interface.js';
import type { SubscribeSagaRepository } from './subscribe-saga.repository.interface.js';
import type { NotificationFacade } from '../../notification/notification.facade.js';
import type { SubscriptionRepository } from '../repository/subscription.repository.interface.js';
import type { NotificationTokensService } from '../tokens/notification-tokens.service.interface.js';

export class RepoEventsConsumer {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly rabbitmqUrl: string,
    private readonly subscriptionRepoRepository: SubscriptionRepoRepository,
    private readonly sagaRepository: SubscribeSagaRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly tokensService: NotificationTokensService,
    private readonly notification: NotificationFacade,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    const result = await createRabbitMQChannel(
      this.rabbitmqUrl,
      REPOSITORIES_EXCHANGE,
    );
    this.connection = result.connection;
    this.channel = result.channel;

    await this.channel.assertQueue(REPO_EVENTS_QUEUE, { durable: true });
    await this.channel.bindQueue(
      REPO_EVENTS_QUEUE,
      REPOSITORIES_EXCHANGE,
      REPO_CREATED_KEY,
    );
    await this.channel.bindQueue(
      REPO_EVENTS_QUEUE,
      REPOSITORIES_EXCHANGE,
      REPO_CREATE_FAILED_KEY,
    );
    this.channel.prefetch(1);

    const { consumerTag } = await this.channel.consume(
      REPO_EVENTS_QUEUE,
      async (msg) => {
        if (!msg) return;
        try {
          await this.handleMessage(msg);
          this.channel!.ack(msg);
        } catch (err) {
          this.logger.error(
            { err },
            '[RepoEventsConsumer]: Failed to process message',
          );
          this.channel!.nack(msg, false, false);
        }
      },
    );

    this.consumerTag = consumerTag;
    this.logger.info('[RepoEventsConsumer]: Listening for repo events');
  }

  public async close(): Promise<void> {
    if (this.consumerTag && this.channel) {
      await this.channel.cancel(this.consumerTag);
    }
    await this.connection?.close();
  }

  private async handleMessage(msg: amqplib.ConsumeMessage): Promise<void> {
    const routingKey = msg.fields.routingKey;

    if (routingKey === REPO_CREATED_KEY) {
      await this.handleRepoCreated(
        JSON.parse(msg.content.toString()) as RepoCreatedEvent,
      );
    } else if (routingKey === REPO_CREATE_FAILED_KEY) {
      await this.handleRepoCreateFailed(
        JSON.parse(msg.content.toString()) as RepoCreateFailedEvent,
      );
    }
  }

  private async handleRepoCreated(event: RepoCreatedEvent): Promise<void> {
    const { sagaId, repoId, repoName } = event;

    await this.subscriptionRepoRepository.createOne({
      id: repoId,
      name: repoName,
    });

    const pendingSagas =
      await this.sagaRepository.findAwaitingByRepoName(repoName);

    for (const saga of pendingSagas) {
      const existing = await this.subscriptionRepository.findOneByRepoAndEmail(
        saga.email,
        repoId,
      );

      if (!existing) {
        const sub = await this.subscriptionRepository.createOne({
          email: saga.email,
          githubRepositoryId: repoId,
        });
        const token = this.tokensService.generateConfirmToken(sub.id);
        await this.notification.queueConfirmationEmail(saga.email, token);
      }

      await this.sagaRepository.markCompleted(saga.id);
    }

    this.logger.info(
      { repoName, completedSagas: pendingSagas.length },
      '[RepoEventsConsumer]: Repo created, sagas completed',
    );

    // If the triggering saga is not in the findAwaitingByRepoName results
    // (e.g. status changed), ensure it's also marked completed
    const triggeringSaga = await this.sagaRepository.findById(sagaId);
    if (triggeringSaga && triggeringSaga.status === 'awaiting_repo') {
      await this.sagaRepository.markCompleted(sagaId);
    }
  }

  private async handleRepoCreateFailed(
    event: RepoCreateFailedEvent,
  ): Promise<void> {
    const { sagaId, reason, message } = event;
    await this.sagaRepository.markFailed(sagaId, `${reason}: ${message}`);
    this.logger.warn(
      { sagaId, reason },
      '[RepoEventsConsumer]: Repo creation failed',
    );
  }
}

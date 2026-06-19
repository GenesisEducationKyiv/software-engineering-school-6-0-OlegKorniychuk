import type amqplib from 'amqplib';
import type { Logger } from 'pino';
import { createRabbitMQChannel } from '../../../shared/messaging/rabbitmq.js';
import {
  REPOSITORIES_EXCHANGE,
  REPO_CREATE_REQUESTED_KEY,
  REPO_CREATE_REQUESTED_QUEUE,
  type RepoCreateRequestedCommand,
} from '../../../shared/messaging/repository.events.js';
import type { RepoRepository } from '../repository/repo-repository.interface.js';
import type { RepositoryScanner } from '../scanner/repository-scanner.service.interface.js';
import type { RepoEventPublisher } from './repo-event.publisher.js';
import {
  GithubApiError,
  GithubApiErrorTypesEnum,
} from '../../../shared/utils/error-handling/errors/github-api.error.js';

export class RepoCommandConsumer {
  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;
  private consumerTag: string | null = null;

  constructor(
    private readonly rabbitmqUrl: string,
    private readonly repoRepository: RepoRepository,
    private readonly repoScanner: RepositoryScanner,
    private readonly eventPublisher: RepoEventPublisher,
    private readonly logger: Logger,
  ) {}

  public async start(): Promise<void> {
    const result = await createRabbitMQChannel(this.rabbitmqUrl, REPOSITORIES_EXCHANGE);
    this.connection = result.connection;
    this.channel = result.channel;

    await this.channel.assertQueue(REPO_CREATE_REQUESTED_QUEUE, { durable: true });
    await this.channel.bindQueue(
      REPO_CREATE_REQUESTED_QUEUE,
      REPOSITORIES_EXCHANGE,
      REPO_CREATE_REQUESTED_KEY,
    );
    this.channel.prefetch(1);

    const { consumerTag } = await this.channel.consume(
      REPO_CREATE_REQUESTED_QUEUE,
      async (msg) => {
        if (!msg) return;
        try {
          await this.handleMessage(msg);
          this.channel!.ack(msg);
        } catch (err) {
          this.logger.error({ err }, '[RepoCommandConsumer]: Failed to process message');
          this.channel!.nack(msg, false, false);
        }
      },
    );

    this.consumerTag = consumerTag;
    this.logger.info('[RepoCommandConsumer]: Listening for repo.create.requested');
  }

  public async close(): Promise<void> {
    if (this.consumerTag && this.channel) {
      await this.channel.cancel(this.consumerTag);
    }
    await this.connection?.close();
  }

  private async handleMessage(msg: amqplib.ConsumeMessage): Promise<void> {
    const command = JSON.parse(msg.content.toString()) as RepoCreateRequestedCommand;
    const { sagaId, owner, repoName } = command;
    const repoFullName = `${owner}/${repoName}`;

    const existing = await this.repoRepository.findByName(repoFullName);
    if (existing) {
      await this.eventPublisher.publishCreated({
        sagaId,
        repoId: existing.id,
        repoName: repoFullName,
      });
      return;
    }

    try {
      await this.repoScanner.verifyRepository(owner, repoName);
    } catch (err) {
      if (err instanceof GithubApiError) {
        if (err.type === GithubApiErrorTypesEnum.notFound) {
          await this.eventPublisher.publishFailed({
            sagaId,
            reason: 'not_found',
            message: err.message,
          });
          return;
        }
        if (err.type === GithubApiErrorTypesEnum.rateLimitExceeded) {
          await this.eventPublisher.publishFailed({
            sagaId,
            reason: 'rate_limited',
            message: err.message,
            ...(err.details.retryAfterMs !== undefined && {
              retryAfterMs: err.details.retryAfterMs,
            }),
          });
          return;
        }
      }
      throw err;
    }

    const repo = await this.repoRepository.createOne({ name: repoFullName });

    await this.eventPublisher.publishCreated({
      sagaId,
      repoId: repo.id,
      repoName: repoFullName,
    });

    this.logger.info({ repoFullName }, '[RepoCommandConsumer]: Repo created');
  }
}

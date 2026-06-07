import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { Queues } from './queue/queues.enum.js';
import type { NotificationFacade } from './notification.facade.js';
import type { SubscriptionFacade } from '../subscription/subscription.facade.js';
import type { ReleaseDetectedPayload } from '../tracker/release-publisher.js';

export class ReleaseDetectedWorker {
  public readonly worker: Worker;

  constructor(
    redisConnection: Redis,
    private readonly subscription: SubscriptionFacade,
    private readonly notification: NotificationFacade,
    private readonly logger: Logger,
  ) {
    this.worker = new Worker(
      Queues.releaseDetected,
      async (job: Job) => {
        const { repoId, repoName, releaseTag } =
          job.data as ReleaseDetectedPayload;

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
      },
      {
        connection: redisConnection,
        autorun: process.env.NODE_ENV !== 'test',
      },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        { err, jobId: job?.id },
        '[ReleaseDetectedWorker]: Job failed',
      );
    });
  }
}

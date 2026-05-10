import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type {
  SendConfirmationEmailPayload,
  SendNotificationEmailPayload,
} from './email-queue.service.interface.js';
import type { NotifierStrategy } from '../notifier/notifier.strategy.js';
import { Queues } from './queues.enum.js';
import { JobTypesEnum } from './job-types.enum.js';

export class EmailWorker {
  public readonly worker: Worker;

  constructor(
    redisConnection: Redis,
    private readonly notifier: NotifierStrategy,
  ) {
    this.worker = new Worker(
      Queues.email,
      async (job: Job) => {
        switch (job.name) {
          case JobTypesEnum.sendConfirmation: {
            const data = job.data as SendConfirmationEmailPayload;
            await this.notifier.sendSubscriptionConfirmation(
              data.email,
              data.token,
            );
            break;
          }
          case JobTypesEnum.sendNotification: {
            const data = job.data as SendNotificationEmailPayload;
            await this.notifier.sendNotification(
              [data.email],
              data.repo,
              data.release,
              data.token,
            );
            break;
          }
          default:
            console.warn(`Unknown job type: ${job.name}`);
        }
      },
      { connection: redisConnection, autorun: process.env.NODE_ENV !== 'test' },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  }
}

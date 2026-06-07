import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { Queues } from './queues.enum.js';
import { JobTypesEnum } from './job-types.enum.js';
import type {
  EmailQueueClient,
  SendConfirmationEmailPayload,
  SendNotificationEmailPayload,
} from './email-queue.service.interface.js';

export class EmailQueueClientImplementation implements EmailQueueClient {
  public readonly queue: Queue;

  constructor(redisConnection: Redis) {
    this.queue = new Queue(Queues.email, { connection: redisConnection });
  }

  public async queueConfirmationEmail(
    payload: SendConfirmationEmailPayload,
  ): Promise<void> {
    await this.queue.add(JobTypesEnum.sendConfirmation, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });
  }

  public async queueNotificationEmail(
    payload: SendNotificationEmailPayload,
  ): Promise<void> {
    await this.queue.add(JobTypesEnum.sendNotification, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });
  }
}

import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import { Queues } from './queues.enum.js';

export type JobHandler = (job: Job) => Promise<void>;

export class EmailWorker {
  public readonly worker: Worker;
  private readonly handlers: Map<string, JobHandler> = new Map();

  constructor(redisConnection: Redis) {
    this.worker = new Worker(
      Queues.email,
      async (job: Job) => {
        const handler = this.handlers.get(job.name);
        if (handler) {
          await handler(job);
        } else {
          console.warn(`Unknown job type: ${job.name}`);
        }
      },
      { connection: redisConnection, autorun: process.env.NODE_ENV !== 'test' },
    );

    this.worker.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });
  }

  public registerHandler(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
  }
}

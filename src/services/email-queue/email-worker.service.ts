import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { Queues } from './queues.enum.js';
import type { MetricsCollector } from '../../metrics-collector.js';

export type JobHandler = (job: Job) => Promise<void>;

export class EmailWorker {
  public readonly worker: Worker;
  private readonly handlers: Map<string, JobHandler> = new Map();

  constructor(
    redisConnection: Redis,
    private readonly logger: Logger,
    private readonly metrics: MetricsCollector,
  ) {
    this.worker = new Worker(
      Queues.email,
      async (job: Job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          this.logger.warn(`Unknown job type: ${job.name}`);
          return;
        }
        await this.metrics.trackEmailJob(job.name, () => handler(job));
      },
      { connection: redisConnection, autorun: process.env.NODE_ENV !== 'test' },
    );

    this.worker.on('failed', (job, err) => {
      this.logger.error({ err }, `Job ${job?.id} failed`);
    });
  }

  public registerHandler(jobName: string, handler: JobHandler): void {
    this.handlers.set(jobName, handler);
  }
}

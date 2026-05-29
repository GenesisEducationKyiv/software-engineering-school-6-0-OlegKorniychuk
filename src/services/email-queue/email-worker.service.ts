import { Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { Queues } from './queues.enum.js';
import { emailJobsTotal, emailJobDurationSeconds } from '../../prometheus.js';

export type JobHandler = (job: Job) => Promise<void>;

export class EmailWorker {
  public readonly worker: Worker;
  private readonly handlers: Map<string, JobHandler> = new Map();

  constructor(
    redisConnection: Redis,
    private readonly logger: Logger,
  ) {
    this.worker = new Worker(
      Queues.email,
      async (job: Job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          this.logger.warn(`Unknown job type: ${job.name}`);
          return;
        }
        const start = Date.now();
        try {
          await handler(job);
          emailJobsTotal.inc({ job_type: job.name, status: 'success' });
        } catch (err) {
          emailJobsTotal.inc({ job_type: job.name, status: 'failed' });
          throw err;
        } finally {
          emailJobDurationSeconds.observe(
            { job_type: job.name },
            (Date.now() - start) / 1000,
          );
        }
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

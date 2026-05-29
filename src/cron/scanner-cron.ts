import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { Queues } from '../services/email-queue/queues.enum.js';
import type { ScanRunner } from './scan-runner.js';
import { scanRunsTotal, scanDurationSeconds } from '../prometheus.js';

export class ScannerCron {
  public readonly queue: Queue;
  public readonly worker: Worker;
  private readonly CRON_PATTERN = '0 * * * *';

  constructor(
    redisConnection: Redis,
    private readonly coordinator: ScanRunner,
    private readonly logger: Logger,
  ) {
    this.queue = new Queue(Queues.scanner, { connection: redisConnection });

    this.worker = new Worker(
      Queues.scanner,
      async () => {
        const start = Date.now();
        try {
          await this.coordinator.runPeriodicScan();
          scanRunsTotal.inc({ status: 'success' });
        } catch (err) {
          scanRunsTotal.inc({ status: 'failed' });
          throw err;
        } finally {
          scanDurationSeconds.observe((Date.now() - start) / 1000);
        }
      },
      { connection: redisConnection, autorun: process.env.NODE_ENV !== 'test' },
    );
  }

  public async startSchedule(): Promise<void> {
    await this.clearSchedulers();
    await this.queue.add(
      'scan-github',
      {},
      {
        repeat: {
          pattern: this.CRON_PATTERN,
        },
      },
    );
    this.logger.info(`[Cron]: Scheduled GitHub scanner (${this.CRON_PATTERN})`);
  }

  private async clearSchedulers() {
    const repeatableJobs = await this.queue.getJobSchedulers();
    for (const job of repeatableJobs) {
      await this.queue.removeJobScheduler(job.key);
    }
  }
}

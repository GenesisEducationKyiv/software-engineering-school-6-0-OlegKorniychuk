import { Queue, Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import { Queues } from '../services/email-queue/queues.enum.js';
import type { ScanRunner } from './scan-runner.js';

export class ScannerCron {
  public readonly queue: Queue;
  public readonly worker: Worker;
  private readonly CRON_PATTERN = '0 * * * *';

  constructor(
    redisConnection: Redis,
    private readonly coordinator: ScanRunner,
  ) {
    this.queue = new Queue(Queues.scanner, { connection: redisConnection });

    this.worker = new Worker(
      Queues.scanner,
      async () => {
        await this.coordinator.runPeriodicScan();
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
    console.log(`[Cron]: Scheduled GitHub scanner (${this.CRON_PATTERN})`);
  }

  private async clearSchedulers() {
    const repeatableJobs = await this.queue.getJobSchedulers();
    for (const job of repeatableJobs) {
      await this.queue.removeJobScheduler(job.key);
    }
  }
}

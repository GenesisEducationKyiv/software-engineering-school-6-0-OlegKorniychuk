import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { Queues } from '../notification/queue/queues.enum.js';

export type ReleaseDetectedPayload = {
  repoId: string;
  repoName: string;
  releaseTag: string;
};

export class ReleasePublisher {
  private readonly queue: Queue;

  constructor(redisConnection: Redis) {
    this.queue = new Queue(Queues.releaseDetected, {
      connection: redisConnection,
    });
  }

  public async publish(
    repoId: string,
    repoName: string,
    releaseTag: string,
  ): Promise<void> {
    await this.queue.add(
      'release.detected',
      { repoId, repoName, releaseTag } satisfies ReleaseDetectedPayload,
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );
  }

  public async close(): Promise<void> {
    await this.queue.close();
  }
}

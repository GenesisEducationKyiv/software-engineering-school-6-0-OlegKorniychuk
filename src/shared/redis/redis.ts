import { Redis } from 'ioredis';
import { env } from 'process';

const redisUrl = env.REDIS_URL;
if (!redisUrl) throw new Error('Redis url is missing');

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

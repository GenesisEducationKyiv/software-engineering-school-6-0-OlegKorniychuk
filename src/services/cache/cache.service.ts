import type { Redis } from 'ioredis';
import type { CacheService } from './cache.service.interface.js';

export class CacheServiceImplementation implements CacheService {
  constructor(private readonly redis: Redis) {}

  public async get<T>(key: string): Promise<T | null> {
    try {
      const cachedData = await this.redis.get(key);
      if (!cachedData) return null;

      try {
        return JSON.parse(cachedData) as T;
      } catch (error) {
        console.error(
          `[CacheService] Failed to parse cache for key: ${key}`,
          error,
        );
        console.error(`[CacheService] Redis connection error`, error);
        return null;
      }
    } catch (err) {
      return null;
    }
  }

  public async set(
    key: string,
    value: unknown,
    ttlSeconds: number = 3600,
  ): Promise<void> {
    try {
      const stringifiedValue = JSON.stringify(value);
      await this.redis.set(key, stringifiedValue, 'EX', ttlSeconds);
    } catch (error) {
      console.error(
        `[CacheService] Failed to set cache for key: ${key}`,
        error,
      );
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(
        `[CacheService] Failed to delete cache for key: ${key}`,
        error,
      );
    }
  }
}

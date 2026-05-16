import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { CacheServiceImplementation } from './cache.service.js';
import type { Redis } from 'ioredis';

describe('CacheService', () => {
  let cacheService: CacheServiceImplementation;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    cacheService = new CacheServiceImplementation(mockRedis);

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('get', () => {
    const mockKey = 'test-key';

    it('should return parsed JSON when data exists in cache', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(mockData));

      const result = await cacheService.get<typeof mockData>(mockKey);

      expect(mockRedis.get).toHaveBeenCalledWith(mockKey);
      expect(result).toEqual(mockData);
    });

    it('should return null when cache misses', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await cacheService.get(mockKey);

      expect(result).toBeNull();
    });

    it('should safely return null and log error when JSON parsing fails', async () => {
      mockRedis.get.mockResolvedValueOnce('this-is-not-valid-json');

      const result = await cacheService.get(mockKey);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it('should safely return null when Redis connection fails', async () => {
      mockRedis.get.mockRejectedValueOnce(
        new Error('Redis connection refused'),
      );

      const result = await cacheService.get(mockKey);

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('set', () => {
    const mockKey = 'test-key';
    const mockValue = { data: 'test' };

    it('should stringify data and set it in Redis with default TTL', async () => {
      await cacheService.set(mockKey, mockValue);

      expect(mockRedis.set as jest.Mock).toHaveBeenCalledWith(
        mockKey,
        JSON.stringify(mockValue),
        'EX',
        3600,
      );
    });

    it('should stringify data and set it in Redis with custom TTL', async () => {
      await cacheService.set(mockKey, mockValue, 60);

      expect(mockRedis.set as jest.Mock).toHaveBeenCalledWith(
        mockKey,
        JSON.stringify(mockValue),
        'EX',
        60,
      );
    });

    it('should safely swallow errors if Redis set fails', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('Redis timeout'));

      await expect(cacheService.set(mockKey, mockValue)).resolves.not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('del', () => {
    it('should delete the key from Redis', async () => {
      await cacheService.del('test-key');
      expect(mockRedis.del).toHaveBeenCalledWith('test-key');
    });

    it('should safely swallow errors if Redis del fails', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Redis timeout'));

      await expect(cacheService.del('test-key')).resolves.not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });
});

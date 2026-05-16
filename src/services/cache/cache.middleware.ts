import type { Request, Response, NextFunction } from 'express';
import type { CacheService } from '../../services/cache/cache.service.interface.js';

export const routeCache = (
  cacheService: CacheService,
  keyGenerator: (req: Request) => string,
  ttlSeconds: number = 3600,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const key = keyGenerator(req);

      const cachedData = await cacheService.get<unknown>(key);
      if (cachedData) {
        console.log(`[Cache Hit] ${key}`);
        return res.status(200).json(cachedData);
      }

      console.log(`[Cache Miss] ${key}`);

      const originalJson = res.json.bind(res);

      res.json = (body: unknown) => {
        cacheService.set(key, body, ttlSeconds).catch((err: unknown) => {
          console.error(`[Cache Error] Failed to set ${key}`, err);
        });

        return originalJson(body);
      };

      next();
    } catch (error) {
      console.error('[Cache Middleware Error]', error);
      next();
    }
  };
};

import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';
import type { CacheService } from './cache.service.interface.js';

export const routeCache = (
  cacheService: CacheService,
  keyGenerator: (req: Request) => string,
  ttlSeconds: number = 3600,
  logger: Logger,
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const key = keyGenerator(req);

      const cachedData = await cacheService.get<unknown>(key);
      if (cachedData) {
        logger.info(`[Cache Hit] ${key}`);
        return res.status(200).json(cachedData);
      }

      logger.info(`[Cache Miss] ${key}`);

      const originalJson = res.json.bind(res);

      res.json = (body: unknown) => {
        cacheService.set(key, body, ttlSeconds).catch((err: unknown) => {
          logger.error({ err }, `[Cache Error] Failed to set ${key}`);
        });

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error({ err: error }, '[Cache Middleware Error]');
      next();
    }
  };
};

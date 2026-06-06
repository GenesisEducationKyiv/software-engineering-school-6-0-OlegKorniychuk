import type { Request, Response, NextFunction } from 'express';
import type { MetricsCollector } from '../../metrics-collector.js';

export function makeMetricsMiddleware(metrics: MetricsCollector) {
  return function metricsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const start = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path ?? req.path;
      metrics.recordHttpRequest(
        req.method,
        route,
        String(res.statusCode),
        duration,
      );
    });

    next();
  };
}

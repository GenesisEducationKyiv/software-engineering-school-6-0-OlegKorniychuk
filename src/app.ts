import express, { type Express } from 'express';

import { pinoHttp } from 'pino-http';
import router from './routes.js';
import { makeHandleError } from './shared/utils/error-handling/handle-error.js';
import { logger } from './shared/utils/logger.js';
import { makeMetricsMiddleware } from './shared/utils/middlewares/metrics.middleware.js';
import type { MetricsCollector } from './shared/metrics/metrics-collector.js';
import { startPrometheus } from './shared/metrics/prometheus.js';

export function createApp(metricsCollector: MetricsCollector): Express {
  const app = express();

  if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }
  app.use(express.json());
  app.use(express.static('public'));
  app.use(express.urlencoded({ extended: false }));
  app.use(makeMetricsMiddleware(metricsCollector));

  app.use(router);

  app.use(makeHandleError(logger));

  return app;
}

export function createMetricsApp(): Express {
  const metricsApp = express();
  startPrometheus(metricsApp);

  return metricsApp;
}

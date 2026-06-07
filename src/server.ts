import 'dotenv/config';
import type { Express } from 'express';

import { createApp, createMetricsApp } from './app.js';
import {
  metricsCollector,
  scannerCron,
  shutdownDependencies,
} from './dependencies-container.js';
import type { ScannerCron } from './modules/tracker/cron/scanner-cron.js';
import { env } from './shared/config/envs.js';
import { logger } from './shared/utils/logger.js';

const startServer = async (app: Express, scannerCron: ScannerCron) => {
  if (process.env.NODE_ENV !== 'test') {
    logger.info('Starting background jobs...');
    await scannerCron.startSchedule();
  }

  return app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
};

const app = createApp(metricsCollector);
const metricsApp = createMetricsApp();

startServer(app, scannerCron)
  .then((server) => {
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        logger.info(
          `Received ${signal}, but shutdown is already in progress...`,
        );
        return;
      }

      isShuttingDown = true;
      logger.info(`${signal} received. Server shutting down...`);

      server.close(async (err) => {
        if (err) {
          logger.error({ err }, 'Error closing Express server');
          process.exit(1);
        }

        try {
          await shutdownDependencies();
          logger.info('Server stopped gracefully.');

          process.exit(0);
        } catch (dbErr) {
          logger.error({ err: dbErr }, 'Error during dependency teardown');
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((error) => {
    logger.error({ err: error }, 'Failed to start server');
    process.exit(1);
  });

metricsApp.listen(3090, () => logger.info('Internal metrics running on 3090'));

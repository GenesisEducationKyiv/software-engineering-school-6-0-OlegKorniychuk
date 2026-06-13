import 'dotenv/config';
import { createApp, createMetricsApp } from './app.js';
import {
  metricsCollector,
  shutdownDependencies,
} from './dependencies-container.js';
import { env } from './shared/config/envs.js';
import { logger } from './shared/utils/logger.js';

const app = createApp(metricsCollector);
const metricsApp = createMetricsApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Server listening on port ${env.PORT}`);
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.info(`Received ${signal}, but shutdown is already in progress...`);
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

metricsApp.listen(3090, () => logger.info('Internal metrics running on 3090'));

import 'dotenv/config';
import express from 'express';
import { trackerEnv } from './shared/config/tracker-envs.js';
import { logger } from './shared/utils/logger.js';
import {
  repoScanner,
  scannerCron,
  shutdownTrackerDependencies,
  initTrackerRabbitMQ,
} from './tracker-dependencies.js';
import { createTrackerRouter } from './modules/tracker/tracker-router.js';

const app = express();
app.use(express.json());
app.use(createTrackerRouter(repoScanner, trackerEnv.API_KEY));

const server = app.listen(trackerEnv.TRACKER_PORT, async () => {
  logger.info(
    `[Tracker]: HTTP server listening on port ${trackerEnv.TRACKER_PORT}`,
  );

  await initTrackerRabbitMQ();

  if (process.env.NODE_ENV !== 'test') {
    await scannerCron.startSchedule();
    logger.info('[Tracker]: Scanner cron scheduled');
  }
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[Tracker]: ${signal} received. Shutting down...`);

  server.close(async (err) => {
    if (err) {
      logger.error({ err }, '[Tracker]: Error closing HTTP server');
      process.exit(1);
    }
    try {
      await shutdownTrackerDependencies();
      logger.info('[Tracker]: Stopped gracefully.');
      process.exit(0);
    } catch (e) {
      logger.error({ err: e }, '[Tracker]: Error during shutdown');
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

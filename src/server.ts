import 'dotenv/config';
import type { Express } from 'express';

import app from './app.js';
import { scannerCron, shutdownDependencies } from './dependencies-container.js';
import type { ScannerCron } from './cron/scanner-cron.js';
import { env } from './config/envs.js';
import { startPrometheus } from './prometheus.js';

const startServer = async (app: Express, scannerCron: ScannerCron) => {
  if (process.env.NODE_ENV !== 'test') {
    startPrometheus(app);
    console.log('Starting background jobs...');
    await scannerCron.startSchedule();
  }

  return app.listen(env.PORT, () => {
    console.log(`Server listening on port ${env.PORT}`);
  });
};

startServer(app, scannerCron)
  .then((server) => {
    let isShuttingDown = false;

    const shutdown = async (signal: string) => {
      if (isShuttingDown) {
        console.log(
          `Received ${signal}, but shutdown is already in progress...`,
        );
        return;
      }

      isShuttingDown = true;
      console.log(`\n${signal} received. Server shutting down...`);

      server.close(async (err) => {
        if (err) {
          console.error('Error closing Express server:', err);
          process.exit(1);
        }

        try {
          await shutdownDependencies();
          console.log('Server stopped gracefully.');

          process.exit(0);
        } catch (dbErr) {
          console.error('Error during dependency teardown:', dbErr);
          process.exit(1);
        }
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

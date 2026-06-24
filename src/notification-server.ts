import 'dotenv/config';
import http2 from 'node:http2';
import express from 'express';
import { connectNodeAdapter } from '@connectrpc/connect-node';
import { notificationEnv } from './notification-service-envs.js';
import { logger } from './shared/utils/logger.js';
import {
  emailQueue,
  notificationDispatcher,
  shutdownNotificationDependencies,
} from './notification-dependencies.js';
import { createNotificationRouter } from './modules/notification/notification.http.controller.js';
import { registerNotificationGrpcHandler } from './modules/notification/grpc/notification.grpc.handler.js';

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/emails', createNotificationRouter(emailQueue, notificationDispatcher));

const httpServer = app.listen(notificationEnv.NOTIFICATION_PORT, () => {
  logger.info(
    `[Notification]: HTTP server listening on port ${notificationEnv.NOTIFICATION_PORT}`,
  );
});

const grpcServer = http2.createServer(
  connectNodeAdapter({
    routes(router) {
      registerNotificationGrpcHandler(router, emailQueue, notificationDispatcher);
    },
  }),
);

grpcServer.listen(notificationEnv.NOTIFICATION_GRPC_PORT, () => {
  logger.info(
    `[Notification]: gRPC server listening on port ${notificationEnv.NOTIFICATION_GRPC_PORT}`,
  );
});

let isShuttingDown = false;

const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[Notification]: ${signal} received. Shutting down...`);

  grpcServer.close();

  httpServer.close(async (err) => {
    if (err) {
      logger.error({ err }, '[Notification]: Error closing HTTP server');
      process.exit(1);
    }
    try {
      await shutdownNotificationDependencies();
      logger.info('[Notification]: Stopped gracefully.');
      process.exit(0);
    } catch (e) {
      logger.error({ err: e }, '[Notification]: Error during shutdown');
      process.exit(1);
    }
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

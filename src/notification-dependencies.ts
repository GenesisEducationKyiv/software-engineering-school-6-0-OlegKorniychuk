import { Redis } from 'ioredis';
import { notificationEnv } from './notification-service-envs.js';
import { logger } from './shared/utils/logger.js';
import { MetricsCollector } from './shared/metrics/metrics-collector.js';
import { NodemailerClient } from './modules/notification/notifier/nodemailer-client.js';
import { EmailNotifierStrategy } from './modules/notification/notifier/email.strategy.js';
import { EmailQueueClientImplementation } from './modules/notification/queue/email-queue.service.js';
import { NotificationDispatcherImplementation } from './modules/notification/notifier/notification-dispatcher.js';
import { EmailWorker } from './modules/notification/queue/email-worker.service.js';
import { JobTypesEnum } from './modules/notification/queue/job-types.enum.js';
import type {
  SendConfirmationEmailPayload,
  SendNotificationEmailPayload,
} from './modules/notification/queue/email-queue.service.interface.js';

const redisConnection = new Redis(notificationEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const mailClient = new NodemailerClient({
  auth: {
    user: notificationEnv.EMAIL_SERVICE_USERNAME,
    pass: notificationEnv.EMAIL_SERVICE_PASSWORD,
  },
  ...('EMAIL_SERVICE' in notificationEnv
    ? { service: notificationEnv.EMAIL_SERVICE }
    : {
        host: notificationEnv.EMAIL_HOST,
        port: notificationEnv.EMAIL_PORT,
      }),
});

const notifier = new EmailNotifierStrategy(
  mailClient,
  notificationEnv.APP_DOMAIN,
);

export const emailQueue = new EmailQueueClientImplementation(redisConnection);
export const notificationDispatcher = new NotificationDispatcherImplementation(
  emailQueue,
);

const metricsCollector = new MetricsCollector();
export const emailWorker = new EmailWorker(
  redisConnection,
  logger,
  metricsCollector,
);

emailWorker.registerHandler(JobTypesEnum.sendConfirmation, async (job) => {
  const data = job.data as SendConfirmationEmailPayload;
  await notifier.sendSubscriptionConfirmation(data.email, data.token);
});

emailWorker.registerHandler(JobTypesEnum.sendNotification, async (job) => {
  const data = job.data as SendNotificationEmailPayload;
  await notifier.sendNotification(
    [data.email],
    data.repo,
    data.release,
    data.token,
  );
});

export const shutdownNotificationDependencies = async () => {
  logger.info('Closing notification service workers and queues...');
  await emailWorker.worker.close();
  await emailQueue.queue.close();
  await redisConnection.quit();
};

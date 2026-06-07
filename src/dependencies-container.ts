import { env } from './shared/config/envs.js';
import { logger } from './shared/utils/logger.js';
import { MetricsCollector } from './shared/metrics/metrics-collector.js';
import { drizzleClient, pool } from './shared/db/client.js';
import { SubscriptionController } from './modules/subscription/subscription.controller.js';
import { subscriptionMapper } from './modules/subscription/subscription.mapper.js';
import { SubscriptionServiceImplementation } from './modules/subscription/subscription.service.js';
import { redisConnection } from './shared/redis/redis.js';
import { GithubRepoRepository } from './modules/tracker/repository/github-repo.repository.js';
import { GithubApiImplementation } from './modules/tracker/github-api/github-api.js';
import { RepositoryScannerImplementation } from './modules/tracker/scanner/repository-scanner.service.js';
import { ReleaseCheckerServiceImplementation } from './modules/tracker/scanner/release-checker.service.js';
import { ScanRunner } from './modules/tracker/cron/scan-runner.js';
import { ScannerCron } from './modules/tracker/cron/scanner-cron.js';
import { TrackerFacade } from './modules/tracker/tracker.facade.js';
import { SubscriptionRepositoryImplementation } from './repositories/subscription/subscription.repository.js';
import { CacheServiceImplementation } from './shared/cache/cache.service.js';
import { EmailQueueClientImplementation } from './services/email-queue/email-queue.service.js';
import { EmailWorker } from './services/email-queue/email-worker.service.js';
import { NotificationTokensServiceImplementation } from './services/notification-tokens-service/notification-tokens.service.js';
import { EmailNotifierStrategy } from './services/notifier/email.strategy.js';
import { NodemailerClient } from './services/notifier/nodemailer-client.js';
import { NotificationDispatcherImplementation } from './services/notifier/notification-dispatcher.js';
import { JobTypesEnum } from './services/email-queue/job-types.enum.js';
import type {
  SendConfirmationEmailPayload,
  SendNotificationEmailPayload,
} from './services/email-queue/email-queue.service.interface.js';

export const metricsCollector = new MetricsCollector();

// Repositories & APIs
const subscriptionRepository = new SubscriptionRepositoryImplementation(
  drizzleClient,
);
const githubRepoRepository = new GithubRepoRepository(drizzleClient);
const githubApi = new GithubApiImplementation(
  env.GITHUB_TOKEN,
  metricsCollector,
);
const repoScanner = new RepositoryScannerImplementation(githubApi);
const trackerFacade = new TrackerFacade(repoScanner);

// Utilities & Clients
export const tokensService = new NotificationTokensServiceImplementation(
  env.NOTIFICATION_TOKEN_SECRET,
);
const mailClient = new NodemailerClient({
  auth: {
    user: env.EMAIL_SERVICE_USERNAME,
    pass: env.EMAIL_SERVICE_PASSWORD,
  },
  ...('EMAIL_SERVICE' in env
    ? { service: env.EMAIL_SERVICE }
    : { host: env.EMAIL_HOST, port: env.EMAIL_PORT }),
});
const notifier = new EmailNotifierStrategy(mailClient, 'http://localhost:3000');
const emailQueue = new EmailQueueClientImplementation(redisConnection);

// New Services for ScanRunner
const releaseChecker = new ReleaseCheckerServiceImplementation(
  githubRepoRepository,
  repoScanner,
);
const notificationDispatcher = new NotificationDispatcherImplementation(
  subscriptionRepository,
  tokensService,
  emailQueue,
);

// Services & Controllers
export const cacheService = new CacheServiceImplementation(
  redisConnection,
  logger,
);

export const subscriptionService = new SubscriptionServiceImplementation(
  subscriptionRepository,
  githubRepoRepository,
  trackerFacade,
  tokensService,
  emailQueue,
  cacheService,
);

export const subscriptionController = new SubscriptionController(
  subscriptionService,
  subscriptionMapper,
);

// Background Jobs
const scanRunner = new ScanRunner(
  githubRepoRepository,
  releaseChecker,
  notificationDispatcher,
  logger,
);

export const scannerCron = new ScannerCron(
  redisConnection,
  scanRunner,
  logger,
  metricsCollector,
);

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

export const shutdownDependencies = async () => {
  logger.info('Closing background workers and queues...');

  await emailWorker.worker.close();
  await scannerCron.worker.close();
  await scannerCron.queue.close();
  await emailQueue.queue.close();

  logger.info('Closing database connections...');

  await redisConnection.quit();

  await pool.end();
};

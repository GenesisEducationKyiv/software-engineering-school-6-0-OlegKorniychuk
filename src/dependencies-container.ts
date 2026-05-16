import { env } from './config/envs.js';
import { ScanRunner } from './cron/scan-runner.js';
import { ScannerCron } from './cron/scanner-cron.js';
import { drizzleClient, pool } from './db/client.js';
import { SubscriptionController } from './modules/subscription/subscription.controller.js';
import { subscriptionMapper } from './modules/subscription/subscription.mapper.js';
import { SubscriptionServiceImplementation } from './modules/subscription/subscription.service.js';
import { redisConnection } from './redis/redis.js';
import { GithubRepoRepository } from './repositories/github-repo/github-repo.repository.js';
import { SubscriptionRepositoryImplementation } from './repositories/subscription/subscription.repository.js';
import { CacheServiceImplementation } from './services/cache/cache.service.js';
import { EmailQueueClientImplementation } from './services/email-queue/email-queue.service.js';
import { EmailWorker } from './services/email-queue/email-worker.service.js';
import { NotificationTokensServiceImplementation } from './services/notification-tokens-service/notification-tokens.service.js';
import { EmailNotifierStrategy } from './services/notifier/email.strategy.js';
import { NodemailerClient } from './services/notifier/nodemailer-client.js';
import { GithubApiImplementation } from './services/scanner/github-api.js';
import { RepositoryScannerImplementation } from './services/scanner/repository-scanner.service.js';
import { ReleaseCheckerServiceImplementation } from './services/scanner/release-checker.service.js';
import { NotificationDispatcherImplementation } from './services/notifier/notification-dispatcher.js';
import { JobTypesEnum } from './services/email-queue/job-types.enum.js';
import type {
  SendConfirmationEmailPayload,
  SendNotificationEmailPayload,
} from './services/email-queue/email-queue.service.interface.js';

// Repositories & APIs
const subscriptionRepository = new SubscriptionRepositoryImplementation(
  drizzleClient,
);
const githubRepoRepository = new GithubRepoRepository(drizzleClient);
const githubApi = new GithubApiImplementation(env.GITHUB_TOKEN);
const repoScanner = new RepositoryScannerImplementation(githubApi);

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
export const cacheService = new CacheServiceImplementation(redisConnection);

export const subscriptionService = new SubscriptionServiceImplementation(
  subscriptionRepository,
  githubRepoRepository,
  repoScanner,
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
);

export const scannerCron = new ScannerCron(redisConnection, scanRunner);

export const emailWorker = new EmailWorker(redisConnection);

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
  console.log('Closing background workers and queues...');

  await emailWorker.worker.close();
  await scannerCron.worker.close();
  await scannerCron.queue.close();
  await emailQueue.queue.close();

  console.log('Closing database connections...');

  await redisConnection.quit();

  await pool.end();
};

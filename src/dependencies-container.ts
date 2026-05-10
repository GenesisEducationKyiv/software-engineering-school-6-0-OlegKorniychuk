import { env } from './config/envs.js';
import { ScanRunner } from './cron/scan-runner.js';
import { ScannerCron } from './cron/scanner-cron.js';
import { drizzleClient, pool } from './db/client.js';
import { SubscriptionController } from './modules/subscription/subscription.controller.js';
import { subscriptionMapper } from './modules/subscription/subscription.mapper.js';
import { SubscriptionServiceImplementation } from './modules/subscription/subscription.service.js';
import { redisConnection } from './redis/redis.js';
import { GithubRepoRepositoryImplementation } from './repositories/github-repo/github-repo.repository.js';
import { SubscriptionRepositoryImplementation } from './repositories/subscription/subscription.repository.js';
import { CacheServiceImplementation } from './services/cache/cache.service.js';
import { EmailQueueClientImplementation } from './services/email-queue/email-queue.service.js';
import { EmailWorker } from './services/email-queue/email-worker.service.js';
import { NotificationTokensServiceImplementation } from './services/notification-tokens-service/notification-tokens.service.js';
import { EmailNotifierStrategy } from './services/notifier/email.strategy.js';
import { NodemailerClient } from './services/notifier/nodemailer-client.js';
import { GithubApiImplementation } from './services/scanner/github-api.js';
import { RepositoryScannerImplementation } from './services/scanner/repository-scanner.service.js';

// Repositories & APIs
const subscriptionRepository = new SubscriptionRepositoryImplementation(
  drizzleClient,
);
const githubRepoRepository = new GithubRepoRepositoryImplementation(
  drizzleClient,
);
const githubApi = new GithubApiImplementation(env.GITHUB_TOKEN);
const repoScanner = new RepositoryScannerImplementation(githubApi);

// Utilities & Clients
const tokensService = new NotificationTokensServiceImplementation(
  env.NOTIFICATION_TOKEN_SECRET,
);
const mailClient = new NodemailerClient(
  env.EMAIL_SERVICE,
  env.EMAIL_SERVICE_USERNAME,
  env.EMAIL_SERVICE_PASSWORD,
);
const notifier = new EmailNotifierStrategy(mailClient, 'http://localhost:3000');
const emailQueue = new EmailQueueClientImplementation(redisConnection);

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
  subscriptionRepository,
  repoScanner,
  tokensService,
  emailQueue,
);

export const scannerCron = new ScannerCron(redisConnection, scanRunner);
export const emailWorker = new EmailWorker(redisConnection, notifier);

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

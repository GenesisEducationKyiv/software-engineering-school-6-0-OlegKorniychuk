import { env } from './shared/config/envs.js';
import { logger } from './shared/utils/logger.js';
import { MetricsCollector } from './shared/metrics/metrics-collector.js';
import { drizzleClient, pool } from './shared/db/client.js';
import { SubscriptionController } from './modules/subscription/subscription.controller.js';
import { subscriptionMapper } from './modules/subscription/subscription.mapper.js';
import { SubscriptionServiceImplementation } from './modules/subscription/subscription.service.js';
import { SubscriptionFacade } from './modules/subscription/subscription.facade.js';
import { redisConnection } from './shared/redis/redis.js';
import { SubscriptionRepositoryImplementation } from './modules/subscription/repository/subscription.repository.js';
import { SubscriptionRepoRepositoryImplementation } from './modules/subscription/repository/subscription-repo.repository.js';
import { SubscribeSagaRepositoryImplementation } from './modules/subscription/saga/subscribe-saga.repository.js';
import { RepoCommandPublisher } from './modules/subscription/saga/repo-command.publisher.js';
import { RepoEventsConsumer } from './modules/subscription/saga/repo-events.consumer.js';
import { CacheServiceImplementation } from './shared/cache/cache.service.js';
import { HttpNotificationFacade } from './modules/notification/http-notification-facade.js';
import { ReleaseDetectedWorker } from './modules/notification/release-detected-worker.js';
import { NotificationTokensServiceImplementation } from './modules/subscription/tokens/notification-tokens.service.js';

export const metricsCollector = new MetricsCollector();

// Repositories
const subscriptionRepository = new SubscriptionRepositoryImplementation(
  drizzleClient,
);
const subscriptionRepoRepository = new SubscriptionRepoRepositoryImplementation(
  drizzleClient,
);

// Tokens + cache
export const tokensService = new NotificationTokensServiceImplementation(
  env.NOTIFICATION_TOKEN_SECRET,
);
export const cacheService = new CacheServiceImplementation(
  redisConnection,
  logger,
);

// Notification
const notificationFacade = new HttpNotificationFacade(
  env.NOTIFICATION_SERVICE_URL,
);

// Saga
const sagaRepository = new SubscribeSagaRepositoryImplementation(drizzleClient);
const repoCommandPublisher = new RepoCommandPublisher(env.RABBITMQ_URL);

// Subscription
export const subscriptionService = new SubscriptionServiceImplementation(
  subscriptionRepository,
  subscriptionRepoRepository,
  sagaRepository,
  repoCommandPublisher,
  tokensService,
  notificationFacade,
  cacheService,
);

const subscriptionFacade = new SubscriptionFacade(
  subscriptionService,
  tokensService,
);

export const subscriptionController = new SubscriptionController(
  subscriptionService,
  subscriptionMapper,
);

export const releaseDetectedWorker = new ReleaseDetectedWorker(
  env.RABBITMQ_URL,
  subscriptionFacade,
  notificationFacade,
  logger,
);

export const repoEventsConsumer = new RepoEventsConsumer(
  env.RABBITMQ_URL,
  subscriptionRepoRepository,
  sagaRepository,
  subscriptionRepository,
  tokensService,
  notificationFacade,
  logger,
);

export const initNotificationRabbitMQ = async () => {
  await releaseDetectedWorker.start();
  await repoCommandPublisher.connect();
  await repoEventsConsumer.start();
};

export const shutdownDependencies = async () => {
  logger.info('Closing background workers and queues...');

  await releaseDetectedWorker.close();
  await repoEventsConsumer.close();
  await repoCommandPublisher.close();

  logger.info('Closing database connections...');

  await redisConnection.quit();
  await pool.end();
};

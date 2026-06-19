import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { trackerEnv } from './shared/config/tracker-envs.js';
import { relations } from './shared/db/schema/relations.js';
import { logger } from './shared/utils/logger.js';
import { MetricsCollector } from './shared/metrics/metrics-collector.js';
import { GithubRepoRepository } from './modules/tracker/repository/github-repo.repository.js';
import { GithubApiImplementation } from './modules/tracker/github-api/github-api.js';
import { RepositoryScannerImplementation } from './modules/tracker/scanner/repository-scanner.service.js';
import { ReleaseCheckerServiceImplementation } from './modules/tracker/scanner/release-checker.service.js';
import { ReleasePublisher } from './modules/tracker/release-publisher.js';
import { ScanRunner } from './modules/tracker/cron/scan-runner.js';
import { ScannerCron } from './modules/tracker/cron/scanner-cron.js';

export const trackerMetrics = new MetricsCollector();

const pool = new Pool({ connectionString: trackerEnv.DATABASE_URL });
const drizzleClient = drizzle({ client: pool, relations });

export const trackerRedis = new Redis(trackerEnv.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const githubRepoRepository = new GithubRepoRepository(drizzleClient);
const githubApi = new GithubApiImplementation(
  trackerEnv.GITHUB_TOKEN,
  trackerMetrics,
);
export const repoScanner = new RepositoryScannerImplementation(githubApi);

const releaseChecker = new ReleaseCheckerServiceImplementation(
  githubRepoRepository,
  repoScanner,
);
const releasePublisher = new ReleasePublisher(trackerEnv.RABBITMQ_URL);
const scanRunner = new ScanRunner(
  githubRepoRepository,
  releaseChecker,
  releasePublisher,
  logger,
);

export const scannerCron = new ScannerCron(
  trackerRedis,
  scanRunner,
  logger,
  trackerMetrics,
);

export const initTrackerRabbitMQ = () => releasePublisher.connect();

export const shutdownTrackerDependencies = async () => {
  logger.info('[Tracker]: Closing workers and queues...');
  await scannerCron.worker.close();
  await scannerCron.queue.close();
  await releasePublisher.close();
  await trackerRedis.quit();
  await pool.end();
};

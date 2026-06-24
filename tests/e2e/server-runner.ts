import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer } from 'testcontainers';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import fs from 'fs';
import path from 'path';
import express from 'express';
import { mockGithubServer } from '../github-mock-api.js';

const MAIN_APP_PORT = 3002;
const NOTIFICATION_PORT = 3003;

async function start() {
  const pgContainer = await new PostgreSqlContainer('postgres:13-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const redisContainer = await new RedisContainer('redis:7-alpine').start();
  const rabbitmqContainer = await new GenericContainer('rabbitmq:3-alpine')
    .withExposedPorts(5672)
    .start();
  const mailpitContainer = await new GenericContainer('axllent/mailpit')
    .withExposedPorts(1025, 8025)
    .start();

  const dbUrl = pgContainer.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  const rabbitmqUrl = `amqp://guest:guest@${rabbitmqContainer.getHost()}:${rabbitmqContainer.getMappedPort(5672)}`;
  const mailpitApiUrl = `http://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(8025)}`;

  // Set env vars for both services before any imports
  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.RABBITMQ_URL = rabbitmqUrl;
  process.env.API_KEY = 'secret-api-key';
  process.env.NOTIFICATION_TOKEN_SECRET = 'test-secret';
  process.env.GITHUB_TOKEN = 'test-github-token';
  process.env.PORT = String(MAIN_APP_PORT);
  process.env.NOTIFICATION_TRANSPORT = 'http';
  process.env.NOTIFICATION_SERVICE_URL = `http://localhost:${NOTIFICATION_PORT}`;
  process.env.MAILPIT_API_URL = mailpitApiUrl;

  // Notification service env vars
  process.env.NOTIFICATION_PORT = String(NOTIFICATION_PORT);
  process.env.APP_DOMAIN = `http://localhost:${MAIN_APP_PORT}`;
  process.env.EMAIL_HOST = mailpitContainer.getHost();
  process.env.EMAIL_PORT = mailpitContainer.getMappedPort(1025).toString();
  process.env.EMAIL_SERVICE_USERNAME = 'test@example.com';
  process.env.EMAIL_SERVICE_PASSWORD = 'test-password';
  delete process.env.EMAIL_SERVICE;

  const envFilePath = path.join(process.cwd(), '.env.e2e');
  if (fs.existsSync(envFilePath)) fs.unlinkSync(envFilePath);
  fs.writeFileSync(
    envFilePath,
    `DATABASE_URL=${dbUrl}\nMAILPIT_API_URL=${mailpitApiUrl}\nNOTIFICATION_TOKEN_SECRET=${process.env.NOTIFICATION_TOKEN_SECRET}`,
  );

  const migrationPool = new pg.Pool({ connectionString: dbUrl });
  const migrationDb = drizzle({ client: migrationPool });
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  await migrationPool.end();

  mockGithubServer.listen({ onUnhandledRequest: 'bypass' });

  // Start notification service
  const notificationDeps = await import('../../src/notification-dependencies.js');
  notificationDeps.emailWorker.worker
    .run()
    .catch((err) => console.error('Notification worker run error:', err));
  notificationDeps.emailWorker.worker.on('error', (err) => {
    console.error('Notification worker connection error:', err);
  });

  const { createNotificationRouter } = await import(
    '../../src/modules/notification/notification.http.controller.js'
  );
  const notificationApp = express();
  notificationApp.use(express.json());
  notificationApp.use(
    '/emails',
    createNotificationRouter(
      notificationDeps.emailQueue,
      notificationDeps.notificationDispatcher,
    ),
  );
  const notificationServer = notificationApp.listen(NOTIFICATION_PORT);

  // Each service owns its own prom-client registry in production (separate processes).
  // In e2e both run in-process, so clear the shared registry between imports.
  const { register } = await import('prom-client');
  register.clear();

  // Start main app
  const deps = await import('../../src/dependencies-container.js');
  await deps.initNotificationRabbitMQ();

  const { createApp } = await import('../../src/app.js');
  const app = createApp(deps.metricsCollector);
  const httpServer = app.listen(MAIN_APP_PORT);

  const shutdown = async () => {
    httpServer.close();
    notificationServer.close();
    await deps.shutdownDependencies();
    await notificationDeps.shutdownNotificationDependencies();
    await pgContainer.stop();
    await redisContainer.stop();
    await rabbitmqContainer.stop();
    await mailpitContainer.stop();
    mockGithubServer.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start E2E server:', err);
  process.exit(1);
});

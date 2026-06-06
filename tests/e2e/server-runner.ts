import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer } from 'testcontainers';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import fs from 'fs';
import path from 'path';
import { mockGithubServer } from '../github-mock-api.js';

async function start() {
  const pgContainer = await new PostgreSqlContainer('postgres:13-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const redisContainer = await new RedisContainer('redis:7-alpine').start();
  const mailpitContainer = await new GenericContainer('axllent/mailpit')
    .withExposedPorts(1025, 8025)
    .start();

  const dbUrl = pgContainer.getConnectionUri();

  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.EMAIL_HOST = mailpitContainer.getHost();
  process.env.EMAIL_PORT = mailpitContainer.getMappedPort(1025).toString();
  process.env.MAILPIT_API_URL = `http://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(8025)}`;
  process.env.API_KEY = 'secret-api-key';
  process.env.NOTIFICATION_TOKEN_SECRET = 'test-secret';
  process.env.GITHUB_TOKEN = 'test-github-token';
  process.env.EMAIL_SERVICE_USERNAME = 'test@example.com';
  process.env.EMAIL_SERVICE_PASSWORD = 'test-password';
  process.env.PORT = '3002';
  delete process.env.EMAIL_SERVICE;

  const envFilePath = path.join(process.cwd(), '.env.e2e');
  if (fs.existsSync(envFilePath)) fs.unlinkSync(envFilePath);

  fs.writeFileSync(
    envFilePath,
    `DATABASE_URL=${process.env.DATABASE_URL}\nMAILPIT_API_URL=${process.env.MAILPIT_API_URL}\nNOTIFICATION_TOKEN_SECRET=${process.env.NOTIFICATION_TOKEN_SECRET}`,
  );

  const migrationPool = new pg.Pool({ connectionString: dbUrl });
  const migrationDb = drizzle({ client: migrationPool });
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  await migrationPool.end();

  mockGithubServer.listen({ onUnhandledRequest: 'bypass' });

  const deps = await import('../../src/dependencies-container.js');
  deps.emailWorker.worker
    .run()
    .catch((err) => console.error('Worker run error:', err));

  deps.emailWorker.worker.on('error', (err) => {
    console.error('Worker connection error:', err);
  });

  const { createApp } = await import('../../src/app.js');
  const app = createApp(deps.metricsCollector);

  const httpServer = app.listen(3002);

  const shutdown = async () => {
    httpServer.close();
    await deps.shutdownDependencies();
    await pgContainer.stop();
    await redisContainer.stop();
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

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import { GenericContainer } from 'testcontainers';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import fs from 'fs';
import path from 'path';

// Mock GitHub API
const server = setupServer(
  http.get('https://api.github.com/repos/:owner/:repo', ({ params }) => {
    const { owner, repo } = params;
    if (owner === 'nonexistent') {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json({
      id: 12345,
      full_name: `${owner}/${repo}`,
      tag_name: 'v1.0.0',
    });
  }),
  http.get(
    'https://api.github.com/repos/:owner/:repo/releases/latest',
    ({ params }) => {
      const { owner } = params;
      if (owner === 'nonexistent') {
        return new HttpResponse(null, { status: 404 });
      }
      return HttpResponse.json({
        tag_name: 'v1.0.0',
      });
    },
  ),
);

async function start() {
  server.listen({ onUnhandledRequest: 'bypass' });

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

  fs.writeFileSync(
    path.join(process.cwd(), '.env.e2e'),
    `DATABASE_URL=${process.env.DATABASE_URL}\nMAILPIT_API_URL=${process.env.MAILPIT_API_URL}\nNOTIFICATION_TOKEN_SECRET=${process.env.NOTIFICATION_TOKEN_SECRET}`,
  );

  const migrationPool = new pg.Pool({ connectionString: dbUrl });
  const migrationDb = drizzle({ client: migrationPool });
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  await migrationPool.end();

  const deps = await import('../../src/dependencies-container.js');
  deps.emailWorker.worker
    .run()
    .catch((err) => console.error('Worker run error:', err));

  const appModule = await import('../../src/app.js');
  const app = appModule.default;

  app.listen(3002, () => {
    console.log('E2E Server listening on port 3002');
  });
}

start().catch(console.error);

import { jest } from '@jest/globals';
import request from 'supertest';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import { githubRepositories } from '../../src/db/schema/repositories.js';
import { subscriptions } from '../../src/db/schema/subscriptions.js';
import type { Express } from 'express';
import type { NotificationTokensService } from '../../src/services/notification-tokens-service/notification-tokens.service.interface.js';
import type { DrizzleClient } from '../../src/db/client.js';
import type { MailpitMessagesResponse } from '../mailpit.interface.js';

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

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;
let mailpitContainer: StartedTestContainer;
let app: Express;
let drizzleClient: DrizzleClient;
let shutdownDependencies: () => Promise<void>;
let mailpitApiUrl: string;
let tokensService: NotificationTokensService;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeAll(async () => {
  jest.setTimeout(120000);

  // Start containers
  pgContainer = await new PostgreSqlContainer('postgres:13-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();
  mailpitContainer = await new GenericContainer('axllent/mailpit')
    .withExposedPorts(1025, 8025)
    .start();

  // Set environment variables
  const dbUrl = pgContainer.getConnectionUri();
  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.EMAIL_HOST = mailpitContainer.getHost();
  process.env.EMAIL_PORT = mailpitContainer.getMappedPort(1025).toString();
  process.env.API_KEY = 'test-api-key';
  process.env.NOTIFICATION_TOKEN_SECRET = 'test-secret';
  process.env.GITHUB_TOKEN = 'test-github-token';
  process.env.EMAIL_SERVICE_USERNAME = 'test@example.com';
  process.env.EMAIL_SERVICE_PASSWORD = 'test-password';
  delete process.env.EMAIL_SERVICE;

  mailpitApiUrl = `http://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(8025)}`;

  // Run migrations
  const migrationPool = new pg.Pool({ connectionString: dbUrl });
  const migrationDb = drizzle({ client: migrationPool });
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  await migrationPool.end();

  // Import app and dependencies
  const dbClient = await import('../../src/db/client.js');
  drizzleClient = dbClient.drizzleClient;

  const deps = await import('../../src/dependencies-container.js');
  shutdownDependencies = deps.shutdownDependencies;
  tokensService = deps.tokensService;

  deps.emailWorker.worker
    .run()
    .catch((err) => console.error('Worker run error:', err));

  const appModule = await import('../../src/app.js');
  app = appModule.default;
}, 120000);

afterAll(async () => {
  if (shutdownDependencies) await shutdownDependencies();
  if (pgContainer) await pgContainer.stop();
  if (redisContainer) await redisContainer.stop();
  if (mailpitContainer) await mailpitContainer.stop();
  jest.restoreAllMocks();
});

beforeEach(async () => {
  if (drizzleClient) {
    await drizzleClient.execute(
      sql`TRUNCATE TABLE subscriptions, github_repositories RESTART IDENTITY CASCADE`,
    );
  }
  await fetch(`${mailpitApiUrl}/api/v1/messages`, { method: 'DELETE' });
});

describe('SubscriptionController Integration Tests', () => {
  const apiKey = 'test-api-key';

  describe('POST /subscribe', () => {
    it('should successfully subscribe to a repository', async () => {
      const email = 'user@example.com';
      const repo = 'owner/repo';

      const response = await request(app)
        .post('/subscribe')
        .set('x-api-key', apiKey)
        .send({ email, repo });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Subscription successful. Confirmation email sent.',
      );

      const subs = await drizzleClient.query.subscriptions.findMany();
      expect(subs.length).toBe(1);

      const repos = await drizzleClient.query.githubRepositories.findMany();
      expect(repos.length).toBe(1);

      let mailData: MailpitMessagesResponse = { total: 0, messages: [] };
      for (let i = 0; i < 20; i++) {
        const mailResponse = await fetch(`${mailpitApiUrl}/api/v1/messages`);
        mailData = (await mailResponse.json()) as MailpitMessagesResponse;
        if (mailData.total > 0) break;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      expect(mailData.total).toBe(1);
      expect(mailData.messages[0]!.Subject).toContain(
        'Confirm your GitHub Release Subscription',
      );
    }, 30000);

    it('should return 404 if repository does not exist on GitHub', async () => {
      const email = 'user@example.com';
      const repo = 'nonexistent/repo';

      const response = await request(app)
        .post('/subscribe')
        .set('x-api-key', apiKey)
        .send({ email, repo });

      expect(response.status).toBe(404);
    });

    it('should return 401 if API key is missing', async () => {
      const response = await request(app)
        .post('/subscribe')
        .send({ email: 'user@example.com', repo: 'owner/repo' });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/subscribe')
        .set('x-api-key', apiKey)
        .send({ email: 'invalid-email', repo: 'owner/repo' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /confirm/:token', () => {
    it('should confirm a subscription', async () => {
      const [repo] = await drizzleClient
        .insert(githubRepositories)
        .values({ name: 'owner/repo' })
        .returning();

      if (!repo) throw new Error('Failed to insert test data');

      const [sub] = await drizzleClient
        .insert(subscriptions)
        .values({
          email: 'user@example.com',
          githubRepositoryId: repo.id,
          confirmed: false,
        })
        .returning();

      if (!sub) throw new Error('Failed to insert test data');

      const token = tokensService.generateConfirmToken(sub.id);

      const response = await request(app).get(`/confirm/${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'Subscription confirmed successfully.',
      );

      const updatedSub = await drizzleClient.query.subscriptions.findFirst({
        where: {
          id: sub.id,
        },
      });
      expect(updatedSub?.confirmed).toBe(true);
    });

    it('should return 400 for an invalid token', async () => {
      const response = await request(app).get('/confirm/invalid-token');
      expect(response.status).toBe(400);
    });
  });

  describe('GET /unsubscribe/:token', () => {
    it('should unsubscribe successfully', async () => {
      const [repo] = await drizzleClient
        .insert(githubRepositories)
        .values({ name: 'owner/repo' })
        .returning();

      if (!repo) throw new Error('Failed to insert test data');

      const [sub] = await drizzleClient
        .insert(subscriptions)
        .values({
          email: 'user@example.com',
          githubRepositoryId: repo.id,
          confirmed: true,
        })
        .returning();

      if (!sub) throw new Error('Failed to insert test data');

      const token = tokensService.generateUnsubscribeToken(sub.id);

      const response = await request(app).get(`/unsubscribe/${token}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Unsubscribed successfully.');

      const subs = await drizzleClient.query.subscriptions.findMany();
      expect(subs.length).toBe(0);
    });

    it('should return 400 for an invalid token', async () => {
      const response = await request(app).get('/unsubscribe/invalid-token');
      expect(response.status).toBe(400);
    });
  });

  describe('GET /subscriptions', () => {
    it('should list all subscriptions for an email', async () => {
      const email = 'user@example.com';
      const [repo1] = await drizzleClient
        .insert(githubRepositories)
        .values({ name: 'owner/repo1' })
        .returning();
      const [repo2] = await drizzleClient
        .insert(githubRepositories)
        .values({ name: 'owner/repo2' })
        .returning();

      if (!repo1 || !repo2) throw new Error('Failed to insert test data');

      await drizzleClient.insert(subscriptions).values([
        { email, githubRepositoryId: repo1.id, confirmed: true },
        { email, githubRepositoryId: repo2.id, confirmed: false },
      ]);

      const response = await request(app)
        .get('/subscriptions')
        .query({ email })
        .set('x-api-key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ repo: 'owner/repo1' }),
          expect.objectContaining({ repo: 'owner/repo2' }),
        ]),
      );
    });

    it('should return data from cache on second request', async () => {
      const email = 'cached@example.com';
      const [repo] = await drizzleClient
        .insert(githubRepositories)
        .values({ name: 'owner/cached-repo' })
        .returning();

      if (!repo) throw new Error('Failed to insert test data');

      await drizzleClient.insert(subscriptions).values({
        email,
        githubRepositoryId: repo.id,
        confirmed: true,
      });

      // First request (Cache Miss)
      const response1 = await request(app)
        .get('/subscriptions')
        .query({ email })
        .set('x-api-key', apiKey);
      expect(response1.status).toBe(200);
      expect(response1.body[0].repo).toBe('owner/cached-repo');

      // Update DB directly (bypassing app cache invalidation)
      await drizzleClient
        .update(githubRepositories)
        .set({ name: 'owner/updated-repo' })
        .where(sql`id = ${repo.id}`);

      // Second request (Cache Hit - should still return old data)
      const response2 = await request(app)
        .get('/subscriptions')
        .query({ email })
        .set('x-api-key', apiKey);
      expect(response2.status).toBe(200);
      expect(response2.body[0].repo).toBe('owner/cached-repo'); // Old data from cache
    });
  });
});

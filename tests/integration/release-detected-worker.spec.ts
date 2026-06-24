import { jest } from '@jest/globals';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer } from 'testcontainers';
import type { StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import amqplib from 'amqplib';
import { subscriptionRepositories } from '../../src/shared/db/schema/subscription-repositories.js';
import { subscriptions } from '../../src/shared/db/schema/subscriptions.js';
import type { DrizzleClient } from '../../src/shared/db/client.js';
import type { MailpitMessagesResponse } from '../mailpit.interface.js';
import {
  RELEASES_EXCHANGE,
  RELEASE_DETECTED_ROUTING_KEY,
  type ReleaseDetectedEvent,
} from '../../src/shared/messaging/release-detected.event.js';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedRedisContainer;
let rabbitmqContainer: StartedTestContainer;
let mailpitContainer: StartedTestContainer;
let drizzleClient: DrizzleClient;
let shutdownDependencies: () => Promise<void>;
let mailpitApiUrl: string;

async function publishReleaseEvent(
  payload: ReleaseDetectedEvent,
): Promise<void> {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL!);
  const ch = await conn.createChannel();
  await ch.assertExchange(RELEASES_EXCHANGE, 'topic', { durable: true });
  ch.publish(
    RELEASES_EXCHANGE,
    RELEASE_DETECTED_ROUTING_KEY,
    Buffer.from(JSON.stringify(payload)),
    { persistent: true },
  );
  await ch.close();
  await conn.close();
}

async function waitForEmails(
  count: number,
  timeoutMs = 15000,
): Promise<MailpitMessagesResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${mailpitApiUrl}/api/v1/messages`);
    const data = (await res.json()) as MailpitMessagesResponse;
    if (data.total >= count) return data;
    await new Promise((r) => setTimeout(r, 500));
  }
  const res = await fetch(`${mailpitApiUrl}/api/v1/messages`);
  return (await res.json()) as MailpitMessagesResponse;
}

beforeAll(async () => {
  jest.setTimeout(120000);

  pgContainer = await new PostgreSqlContainer('postgres:13-alpine')
    .withDatabase('test')
    .withUsername('test')
    .withPassword('test')
    .start();

  redisContainer = await new RedisContainer('redis:7-alpine').start();
  rabbitmqContainer = await new GenericContainer('rabbitmq:3-alpine')
    .withExposedPorts(5672)
    .start();
  mailpitContainer = await new GenericContainer('axllent/mailpit')
    .withExposedPorts(1025, 8025)
    .start();

  const dbUrl = pgContainer.getConnectionUri();
  process.env.DATABASE_URL = dbUrl;
  process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  process.env.RABBITMQ_URL = `amqp://guest:guest@${rabbitmqContainer.getHost()}:${rabbitmqContainer.getMappedPort(5672)}`;
  process.env.EMAIL_HOST = mailpitContainer.getHost();
  process.env.EMAIL_PORT = mailpitContainer.getMappedPort(1025).toString();
  process.env.API_KEY = 'test-api-key';
  process.env.NOTIFICATION_TOKEN_SECRET = 'test-secret';
  process.env.GITHUB_TOKEN = 'test-github-token';
  process.env.EMAIL_SERVICE_USERNAME = 'test@example.com';
  process.env.EMAIL_SERVICE_PASSWORD = 'test-password';
  delete process.env.EMAIL_SERVICE;

  mailpitApiUrl = `http://${mailpitContainer.getHost()}:${mailpitContainer.getMappedPort(8025)}`;

  const migrationPool = new pg.Pool({ connectionString: dbUrl });
  const migrationDb = drizzle({ client: migrationPool });
  await migrate(migrationDb, { migrationsFolder: './drizzle' });
  await migrationPool.end();

  const dbClient = await import('../../src/shared/db/client.js');
  drizzleClient = dbClient.drizzleClient;

  const deps = await import('../../src/dependencies-container.js');
  shutdownDependencies = deps.shutdownDependencies;

  deps.emailWorker.worker
    .run()
    .catch((err) => console.error('Worker run error:', err));

  await deps.initNotificationRabbitMQ();
}, 120000);

afterAll(async () => {
  if (shutdownDependencies) await shutdownDependencies();
  if (pgContainer) await pgContainer.stop();
  if (redisContainer) await redisContainer.stop();
  if (rabbitmqContainer) await rabbitmqContainer.stop();
  if (mailpitContainer) await mailpitContainer.stop();
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await drizzleClient.execute(
    sql`TRUNCATE TABLE subscriptions, subscription_repositories, subscribe_sagas RESTART IDENTITY CASCADE`,
  );
  await fetch(`${mailpitApiUrl}/api/v1/messages`, { method: 'DELETE' });
});

describe('ReleaseDetectedWorker Integration Tests', () => {
  it('sends notification email to confirmed subscriber', async () => {
    const [repo] = await drizzleClient
      .insert(subscriptionRepositories)
      .values({ id: '00000000-0000-0000-0000-000000000001', name: 'owner/repo' })
      .returning();
    if (!repo) throw new Error('Failed to insert repo');

    await drizzleClient.insert(subscriptions).values({
      email: 'confirmed@example.com',
      githubRepositoryId: repo.id,
      confirmed: true,
    });

    await publishReleaseEvent({
      repoId: repo.id,
      repoName: 'owner/repo',
      releaseTag: 'v1.2.0',
    });

    const mailData = await waitForEmails(1);

    expect(mailData.total).toBe(1);
    expect(mailData.messages[0]!.Subject).toBe('New Release: owner/repo v1.2.0');
    expect(mailData.messages[0]!.To[0]!.Address).toBe('confirmed@example.com');
  }, 30000);

  it('sends no email when subscriber is unconfirmed', async () => {
    const [repo] = await drizzleClient
      .insert(subscriptionRepositories)
      .values({ id: '00000000-0000-0000-0000-000000000001', name: 'owner/repo' })
      .returning();
    if (!repo) throw new Error('Failed to insert repo');

    await drizzleClient.insert(subscriptions).values({
      email: 'unconfirmed@example.com',
      githubRepositoryId: repo.id,
      confirmed: false,
    });

    await publishReleaseEvent({
      repoId: repo.id,
      repoName: 'owner/repo',
      releaseTag: 'v2.0.0',
    });

    await new Promise((r) => setTimeout(r, 3000));

    const res = await fetch(`${mailpitApiUrl}/api/v1/messages`);
    const mailData = (await res.json()) as MailpitMessagesResponse;
    expect(mailData.total).toBe(0);
  }, 15000);

  it('sends notification emails to all confirmed subscribers', async () => {
    const [repo] = await drizzleClient
      .insert(subscriptionRepositories)
      .values({ id: '00000000-0000-0000-0000-000000000001', name: 'owner/multi-repo' })
      .returning();
    if (!repo) throw new Error('Failed to insert repo');

    const emails = ['alice@example.com', 'bob@example.com', 'carol@example.com'];
    await drizzleClient.insert(subscriptions).values(
      emails.map((email) => ({
        email,
        githubRepositoryId: repo.id,
        confirmed: true,
      })),
    );

    await publishReleaseEvent({
      repoId: repo.id,
      repoName: 'owner/multi-repo',
      releaseTag: 'v3.0.0',
    });

    const mailData = await waitForEmails(3);

    expect(mailData.total).toBe(3);
    const recipients = mailData.messages.map((m) => m.To[0]!.Address).sort();
    expect(recipients).toEqual([...emails].sort());
    for (const msg of mailData.messages) {
      expect(msg.Subject).toBe('New Release: owner/multi-repo v3.0.0');
    }
  }, 30000);
});
